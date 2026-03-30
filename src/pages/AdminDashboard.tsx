import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { extractPdfTextFromBlob } from "@/utils/extractPdfText";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  FileText,
  LogOut,
  Download,
  Eye,
  Search,
  Users,
  FileSpreadsheet,
  Sparkles,
  X,
  Clock,
  CheckCircle,
  XCircle,
  FileSearch,
  Filter,
  RotateCcw
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { User, Session } from "@supabase/supabase-js";

type ApplicationStatus = 'pending' | 'reviewed' | 'accepted' | 'rejected';

interface Applicant {
  id: string;
  full_name: string;
  email: string;
  highest_degree: string;
  years_of_experience: number;
  preferred_course: string;
  cv_file_path: string;
  date_of_birth: string;
  comments: string | null;
  keyword_match_score: number | null;
  cv_extracted_text: string | null;
  matched_keywords: string[] | null;
  created_at: string;
  status: ApplicationStatus;
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [keywords, setKeywords] = useState("");
  useEffect(() => {
    const savedKeywords = localStorage.getItem("ats_keywords");

    if (savedKeywords) {
      setKeywords(savedKeywords);
      setAppliedKeywords(savedKeywords.split(","));
    }
  }, []);
  const [appliedKeywords, setAppliedKeywords] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState<string | null>(null);

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | "all">("all");
  const [courseFilter, setCourseFilter] = useState<string>("all");

  // Get unique courses for filter dropdown
  const uniqueCourses = [...new Set(applicants.map(a => a.preferred_course))];

  // Filter applicants based on search and filters
  const filteredApplicants = applicants.filter(applicant => {
    const matchesSearch = searchQuery === "" ||
      applicant.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      applicant.email.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "all" || applicant.status === statusFilter;
    const matchesCourse = courseFilter === "all" || applicant.preferred_course === courseFilter;

    return matchesSearch && matchesStatus && matchesCourse;
  });

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (!session) {
          navigate("/admin/login");
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (!session) {
        navigate("/admin/login");
      } else {
        fetchApplicants();
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchApplicants = async () => {
    try {
      const { data, error } = await supabase
        .from("applicants")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setApplicants(data || []);
    } catch (error: any) {
      console.error("Error fetching applicants:", error);
      toast.error("Failed to load applicants");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/admin/login");
  };

  const downloadCV = async (filePath: string, applicantName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("cvs")
        .download(filePath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${applicantName.replace(/\s+/g, "_")}_CV.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error("Download error:", error);
      toast.error("Failed to download CV");
    }
  };

  const analyzeCV = async (applicant: Applicant) => {
    setIsAnalyzing(applicant.id);

    try {
      const customKeywords = keywords
        .toLowerCase()
        .split(/[,\s]+/)
        .map((k) => k.trim())
        .filter((k) => k.length > 0);
      setAppliedKeywords(customKeywords);

      // ✅ STEP A: download the PDF from storage
      const { data: pdfBlob, error: downloadError } = await supabase.storage
        .from("cvs")
        .download(applicant.cv_file_path);

      if (downloadError) throw downloadError;

      // ✅ STEP B: extract text in browser
      const extractedText = await extractPdfTextFromBlob(pdfBlob);

      console.log("✅ Extracted text length:", extractedText.length);
      console.log("✅ Sample:", extractedText.slice(0, 300));

      if (!extractedText || extractedText.length < 30) {
        toast.error("Could not extract text from PDF. (Might be scanned image PDF)");
        return;
      }

      // ✅ STEP C: call edge function with extractedText
      const { data, error } = await supabase.functions.invoke("parse-cv", {
        body: {
          applicantId: applicant.id,
          extractedText,          // ✅ SEND TEXT
          customKeywords,
        },
      });

      if (error) throw error;

      await fetchApplicants();
      toast.success(`CV analyzed! Match score: ${data.score}%`);
    } catch (error: any) {
      console.error("Error analyzing CV:", error);
      toast.error("Failed to analyze CV");
    } finally {
      setIsAnalyzing(null);
    }
  };


  const analyzeAllCVs = async () => {
    const newKeywords = keywords
      .toLowerCase()
      .split(/[,\s]+/)
      .map((k) => k.trim())
      .filter((k) => k.length > 0);

    // ✅ Merge + remove duplicates
    const customKeywords = [...new Set([...appliedKeywords, ...newKeywords])];

    // ✅ Update state + storage
    setAppliedKeywords(customKeywords);
    localStorage.setItem("ats_keywords", customKeywords.join(","));

    // ✅ Clear input (optional but recommended)
    setKeywords("");
    toast.info(`Analyzing ${applicants.length} CVs...`);

    for (const applicant of applicants) {
      try {
        // ✅ download CV
        const { data: pdfBlob, error: downloadError } = await supabase.storage
          .from("cvs")
          .download(applicant.cv_file_path);

        if (downloadError) throw downloadError;

        // ✅ extract text
        const extractedText = await extractPdfTextFromBlob(pdfBlob);

        if (!extractedText || extractedText.length < 30) {
          console.warn("Skipping - no extracted text:", applicant.full_name);
          continue;
        }

        // ✅ invoke function
        await supabase.functions.invoke("parse-cv", {
          body: {
            applicantId: applicant.id,
            extractedText,
            customKeywords,
          },
        });
      } catch (error) {
        console.error(`Error analyzing CV for ${applicant.full_name}:`, error);
      }
    }

    await fetchApplicants();
    toast.success("All CVs analyzed!");
  };


  const sendStatusNotification = async (applicant: Applicant, newStatus: ApplicationStatus) => {
    try {
      const { error } = await supabase.functions.invoke("send-status-notification", {
        body: {
          applicantName: applicant.full_name,
          applicantEmail: applicant.email,
          newStatus: newStatus,
          preferredCourse: applicant.preferred_course,
        },
      });

      if (error) {
        console.error("Email notification error:", error);
        return false;
      }
      return true;
    } catch (error) {
      console.error("Failed to send notification:", error);
      return false;
    }
  };

  const updateStatus = async (applicantId: string, newStatus: ApplicationStatus) => {
    const applicant = applicants.find(a => a.id === applicantId);
    if (!applicant) return;

    try {
      const { error } = await supabase
        .from("applicants")
        .update({ status: newStatus })
        .eq("id", applicantId);

      if (error) throw error;

      setApplicants(prev =>
        prev.map(a => a.id === applicantId ? { ...a, status: newStatus } : a)
      );

      // Send email notification
      const emailSent = await sendStatusNotification(applicant, newStatus);
      if (emailSent) {
        toast.success(`Status updated to ${newStatus} - Email sent to ${applicant.email}`);
      } else {
        toast.success(`Status updated to ${newStatus} (Email notification failed)`);
      }
    } catch (error: any) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    }
  };

  const exportToCSV = () => {
    const headers = [
      "Name",
      "Email",
      "Date of Birth",
      "Highest Degree",
      "Years of Experience",
      "Preferred Course",
      "Status",
      "Comments",
      "Match Score (%)",
      "Matched Keywords",
      "Applied At",
    ];

    const rows = filteredApplicants.map((a) => [  // ✅ FIXED
    a.full_name,
      a.email,
      a.date_of_birth,
      a.highest_degree,
      a.years_of_experience.toString(),
      a.preferred_course,
      a.status,
      a.comments || "",
      a.keyword_match_score?.toString() || "N/A",
      a.matched_keywords?.join("; ") || "",
      new Date(a.created_at).toLocaleString(),
      ]);

const csvContent = [
  headers.join(","),
  ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
].join("\n");

const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
const url = URL.createObjectURL(blob);
const a = document.createElement("a");
a.href = url;
a.download = `applicants_export_${new Date().toISOString().split("T")[0]}.csv`;
document.body.appendChild(a);
a.click();
document.body.removeChild(a);
URL.revokeObjectURL(url);

toast.success("CSV exported successfully!");
    };

if (loading) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Loading...</div>
    </div>
  );
}

return (
  <div className="min-h-screen bg-background">
    {/* Header */}
    <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container flex items-center justify-between h-16">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg gradient-hero flex items-center justify-center">
            <FileText className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <span className="font-display font-bold text-xl">Admin Dashboard</span>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </header>

    <main className="container py-8">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <div className="card-elevated p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-2xl font-display font-bold">{applicants.length}</p>
            </div>
          </div>
        </div>

        <div className="card-elevated p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pending</p>
              <p className="text-2xl font-display font-bold">{applicants.filter(a => a.status === 'pending').length}</p>
            </div>
          </div>
        </div>

        <div className="card-elevated p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center">
              <FileSearch className="w-5 h-5 text-info" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Reviewed</p>
              <p className="text-2xl font-display font-bold">{applicants.filter(a => a.status === 'reviewed').length}</p>
            </div>
          </div>
        </div>

        <div className="card-elevated p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Accepted</p>
              <p className="text-2xl font-display font-bold">{applicants.filter(a => a.status === 'accepted').length}</p>
            </div>
          </div>
        </div>

        <div className="card-elevated p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
              <XCircle className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Rejected</p>
              <p className="text-2xl font-display font-bold">{applicants.filter(a => a.status === 'rejected').length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Keyword Matching */}
      <div className="card-elevated p-6 mb-8">
        <h2 className="font-display text-lg font-semibold mb-2">Resume Keyword Matching</h2>
        <p className="text-sm text-muted-foreground mb-4">
          CV content is automatically analyzed. Add custom keywords below to include in the matching.
        </p>

        <div className="flex flex-col  gap-4">
          {/* Row 1: Input + Button */}
          <div className="flex gap-4">
            <Input
              placeholder="Add custom keywords (optional, e.g., Java, SQL, Japanese)"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              className="h-12 flex-1"
            />
            <Button onClick={analyzeAllCVs} size="lg" variant="hero">
              <Sparkles className="w-4 h-4 mr-2" />
              Analyze All CVs
            </Button>
          </div>



          {/* Row 2: Keywords */}
          {appliedKeywords.length > 0 && (
            <div className=" flex flex-wrap gap-2 w-full">
              <span className="text-sm text-muted-foreground mr-2">
                Applied Keywords:
              </span>

              {appliedKeywords.map((keyword, index) => (
                <div
                  key={index}
                  className="flex items-center gap-1 border rounded-full px-3 py-1"
                >
                  <span className="capitalize text-sm">{keyword}</span>

                  <button
                    onClick={() => {
                      const updated = appliedKeywords.filter((k) => k !== keyword);
                      setAppliedKeywords(updated);
                      localStorage.setItem("ats_keywords", updated.join(","));
                    }}
                    className="text-xs ml-1 hover:text-red-500"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setKeywords("");
                  setAppliedKeywords([]);
                  localStorage.removeItem("ats_keywords");
                }}
                className="ml-2"
              >
                Clear
              </Button>
            </div>
          )}

        </div>
      </div>

      {/* Search & Filters */}
      <div className="card-elevated p-6 mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-muted-foreground" />
          <h2 className="font-display text-lg font-semibold">Search & Filter</h2>
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(value: ApplicationStatus | "all") => setStatusFilter(value)}
          >
            <SelectTrigger className="w-[160px] h-10">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">
                <span className="flex items-center gap-2">
                  <Clock className="w-3 h-3 text-warning" />
                  Pending
                </span>
              </SelectItem>
              <SelectItem value="reviewed">
                <span className="flex items-center gap-2">
                  <FileSearch className="w-3 h-3 text-info" />
                  Reviewed
                </span>
              </SelectItem>
              <SelectItem value="accepted">
                <span className="flex items-center gap-2">
                  <CheckCircle className="w-3 h-3 text-success" />
                  Accepted
                </span>
              </SelectItem>
              <SelectItem value="rejected">
                <span className="flex items-center gap-2">
                  <XCircle className="w-3 h-3 text-destructive" />
                  Rejected
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={courseFilter}
            onValueChange={(value) => setCourseFilter(value)}
          >
            <SelectTrigger className="w-[180px] h-10">
              <SelectValue placeholder="Filter by course" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Courses</SelectItem>
              {uniqueCourses.map((course) => (
                <SelectItem key={course} value={course}>
                  {course}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(searchQuery || statusFilter !== "all" || courseFilter !== "all") && (
            <Button
              variant="outline"
              size="default"
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("all");
                setCourseFilter("all");
              }}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset
            </Button>
          )}
        </div>


        {(searchQuery || statusFilter !== "all" || courseFilter !== "all") && (
          <p className="mt-3 text-sm text-muted-foreground">
            Showing {filteredApplicants.length} of {applicants.length} applicants
          </p>
        )}
      </div>

      {/* Applicants Table */}
      <div className="card-elevated overflow-hidden">
        <div className="p-6 border-b flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">All Applicants</h2>
          <Button variant="outline" size="sm" onClick={exportToCSV}>
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Degree</TableHead>
                <TableHead>Experience</TableHead>
                <TableHead>Preferred Course</TableHead>
                <TableHead>Match Score</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredApplicants.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    {applicants.length === 0
                      ? "No applicants yet. Applications will appear here."
                      : "No applicants match your search criteria."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredApplicants.map((applicant) => (
                  <TableRow key={applicant.id}>
                    <TableCell className="font-medium">{applicant.full_name}</TableCell>
                    <TableCell>{applicant.email}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{applicant.highest_degree}</Badge>
                    </TableCell>
                    <TableCell>{applicant.years_of_experience} years</TableCell>
                    <TableCell>{applicant.preferred_course}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {applicant.keyword_match_score !== null ? (
                          <Badge
                            title={
                              applicant.matched_keywords && applicant.matched_keywords.length > 0
                                ? applicant.matched_keywords.join(", ")
                                : "No matched keywords"
                            }
                            variant={applicant.keyword_match_score >= 50 ? "default" : "secondary"}
                            className={applicant.keyword_match_score >= 50 ? "bg-success" : ""}
                          >
                            {applicant.keyword_match_score}%
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => analyzeCV(applicant)}
                          disabled={isAnalyzing === applicant.id}
                          className="h-6 w-6 p-0"
                        >
                          <Sparkles className={`w-3 h-3 ${isAnalyzing === applicant.id ? 'animate-spin' : ''}`} />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={applicant.status}
                        onValueChange={(value: ApplicationStatus) => updateStatus(applicant.id, value)}
                      >
                        <SelectTrigger className="w-[130px] h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">
                            <span className="flex items-center gap-2">
                              <Clock className="w-3 h-3 text-warning" />
                              Pending
                            </span>
                          </SelectItem>
                          <SelectItem value="reviewed">
                            <span className="flex items-center gap-2">
                              <FileSearch className="w-3 h-3 text-info" />
                              Reviewed
                            </span>
                          </SelectItem>
                          <SelectItem value="accepted">
                            <span className="flex items-center gap-2">
                              <CheckCircle className="w-3 h-3 text-success" />
                              Accepted
                            </span>
                          </SelectItem>
                          <SelectItem value="rejected">
                            <span className="flex items-center gap-2">
                              <XCircle className="w-3 h-3 text-destructive" />
                              Rejected
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/admin/applicant/${applicant.id}`)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => downloadCV(applicant.cv_file_path, applicant.full_name)}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </main>
  </div>
);
  };

export default AdminDashboard;
