import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as pdfjsLib from "https://esm.sh/pdfjs-dist@4.2.67/legacy/build/pdf.mjs";
(pdfjsLib as any).GlobalWorkerOptions.workerSrc =
  "https://esm.sh/pdfjs-dist@4.2.67/legacy/build/pdf.worker.mjs";



const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Predefined job-related keywords for matching
const JOB_KEYWORDS = [
  // Programming Languages
  "java", "javascript", "typescript", "python", "c++", "c#", "ruby", "php", "swift", "kotlin", "go", "rust", "scala",
  // Web Technologies
  "html", "css", "react", "angular", "vue", "node.js", "nodejs", "express", "next.js", "nextjs", "tailwind",
  // Databases
  "sql", "mysql", "postgresql", "mongodb", "redis", "oracle", "sqlite", "dynamodb", "firebase",
  // Cloud & DevOps
  "aws", "azure", "gcp", "docker", "kubernetes", "jenkins", "ci/cd", "terraform", "ansible",
  // Languages (especially Japanese-related)
  "japanese", "jlpt", "n1", "n2", "n3", "n4", "n5", "english", "mandarin", "korean",
  // Soft Skills
  "communication", "leadership", "teamwork", "problem-solving", "analytical", "project management",
  // Education
  "bachelor", "master", "phd", "doctorate", "degree", "university", "college", "certification",
  // Experience Keywords
  "senior", "junior", "lead", "manager", "architect", "developer", "engineer", "analyst", "consultant",
  // Other Technical Skills
  "api", "rest", "graphql", "microservices", "agile", "scrum", "git", "linux", "machine learning", "ai", "data science",
];

// Extract text from PDF using pdf-parse compatible approach
async function extractTextFromPDF(pdfBuffer: ArrayBuffer): Promise<string> {
  try {
    const loadingTask = (pdfjsLib as any).getDocument({
      data: pdfBuffer,
      disableWorker: true,
    });

    const pdf = await loadingTask.promise;
    let fullText = "";

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      const strings = content.items.map((item: any) => item.str);
      fullText += strings.join(" ") + "\n";
    }

    return fullText.replace(/\s+/g, " ").trim();
  } catch (err) {
    console.error("PDF extraction error (pdfjs legacy):", err);
    return "";
  }
}

function keywordExists(text: string, keyword: string): boolean {
  const t = text.toLowerCase();
  const k = keyword.toLowerCase();

  // if keyword contains symbols, just use includes()
  if (/[^a-z0-9\s]/i.test(k)) {
    return t.includes(k);
  }

  // normal keyword word-boundary match
  const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(t);
}

function calculateKeywordMatch(text: string, customKeywords: string[] = []): {
  score: number;
  matchedKeywords: string[];
} {
  const lowerText = text.toLowerCase();
  const allKeywords = [...new Set([...JOB_KEYWORDS, ...customKeywords.map(k => k.toLowerCase())])];
  
  const matchedKeywords: string[] = [];
  
  for (const keyword of allKeywords) {
    // Use word boundary matching for accuracy
    if (keywordExists(lowerText, keyword)) {
  matchedKeywords.push(keyword);
}

  }
  
  // Calculate score based on matched keywords (max 100%)
  const score = Math.min(100, matchedKeywords.length * 10);

  
  return { score, matchedKeywords };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { applicantId, cvFilePath, customKeywords } = await req.json();
    
    if (!applicantId || !cvFilePath) {
      return new Response(
        JSON.stringify({ error: "Missing applicantId or cvFilePath" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing CV for applicant: ${applicantId}, file: ${cvFilePath}`);

    // Download the CV from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("cvs")
      .download(cvFilePath);

    if (downloadError) {
      console.error("Download error:", downloadError);
      return new Response(
        JSON.stringify({ error: "Failed to download CV", details: downloadError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract text from PDF
    const pdfBuffer = await fileData.arrayBuffer();
    const extractedText = await extractTextFromPDF(pdfBuffer);
    console.log("EXTRACTED TEXT SAMPLE:", extractedText.slice(0, 300));

    console.log(`Extracted ${extractedText.length} characters from PDF`);

    // Calculate keyword match
    const { score, matchedKeywords } = calculateKeywordMatch(
      extractedText, 
      customKeywords || []
    );
    
    console.log(`Match score: ${score}%, Matched keywords: ${matchedKeywords.join(", ")}`);

    // Update the applicant record
    const { error: updateError } = await supabase
      .from("applicants")
      .update({
        cv_extracted_text: extractedText.substring(0, 50000), // Limit to 50k chars
        matched_keywords: matchedKeywords,
        keyword_match_score: score,
      })
      .eq("id", applicantId);

    if (updateError) {
      console.error("Update error:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update applicant", details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        extractedTextLength: extractedText.length,
        score,
        matchedKeywords,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error processing CV:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "Internal server error", details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
