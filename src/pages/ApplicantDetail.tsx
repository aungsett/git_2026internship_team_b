import { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  ArrowLeft, 
  Download, 
  User, 
  Mail, 
  Calendar, 
  GraduationCap, 
  Briefcase, 
  BookOpen, 
  MessageSquare,
  Clock,
  CheckCircle,
  XCircle,
  FileSearch,
  Sparkles,
  Tag
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Session } from "@supabase/supabase-js";

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

const ApplicantDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [applicant, setApplicant] = useState<Applicant | null>(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        if (!session) {
          navigate("/admin/login");
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) {
        navigate("/admin/login");
      } else {
        fetchApplicant();
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, id]);

  const fetchApplicant = async () => {
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from("applicants")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      setApplicant(data);
    } catch (error: any) {
      console.error("Error fetching applicant:", error);
      toast.error("Failed to load applicant details");
      navigate("/admin/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const downloadCV = async () => {
    if (!applicant) return;

    try {
      const { data, error } = await supabase.storage
        .from("cvs")
        .download(applicant.cv_file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${applicant.full_name.replace(/\s+/g, "_")}_CV.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error("Download error:", error);
      toast.error("Failed to download CV");
    }
  };

  const sendStatusNotification = async (newStatus: ApplicationStatus) => {
    if (!applicant) return false;

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

  const updateStatus = async (newStatus: ApplicationStatus) => {
    if (!applicant) return;

    try {
      const { error } = await supabase
        .from("applicants")
        .update({ status: newStatus })
        .eq("id", applicant.id);

      if (error) throw error;

      setApplicant({ ...applicant, status: newStatus });

      // Send email notification
      const emailSent = await sendStatusNotification(newStatus);
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

  const getStatusBadge = (status: ApplicationStatus) => {
    const config = {
      pending: { icon: Clock, color: "bg-warning/10 text-warning", label: "Pending" },
      reviewed: { icon: FileSearch, color: "bg-info/10 text-info", label: "Reviewed" },
      accepted: { icon: CheckCircle, color: "bg-success/10 text-success", label: "Accepted" },
      rejected: { icon: XCircle, color: "bg-destructive/10 text-destructive", label: "Rejected" },
    };
    const { icon: Icon, color, label } = config[status];
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${color}`}>
        <Icon className="w-4 h-4" />
        <span className="font-medium">{label}</span>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!applicant) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Applicant not found</div>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-8">
        <Link
          to="/admin/dashboard"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>

        <div className="max-w-3xl mx-auto">
          {/* Header Card */}
          <div className="card-elevated p-8 mb-6 animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full gradient-hero flex items-center justify-center">
                  <span className="text-2xl font-bold text-primary-foreground">
                    {applicant.full_name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h1 className="font-display text-2xl font-bold">{applicant.full_name}</h1>
                  <p className="text-muted-foreground">{applicant.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {getStatusBadge(applicant.status)}
                <Button onClick={downloadCV} variant="hero" size="lg">
                  <Download className="w-4 h-4 mr-2" />
                  Download CV
                </Button>
              </div>
            </div>
          </div>

          {/* Status Management Card */}
          <div className="card-elevated p-6 mb-6 animate-fade-in">
            <h2 className="font-display text-lg font-semibold mb-4">Update Application Status</h2>
            <Select
              value={applicant.status}
              onValueChange={(value: ApplicationStatus) => updateStatus(value)}
            >
              <SelectTrigger className="w-full md:w-[250px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">
                  <span className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-warning" />
                    Pending
                  </span>
                </SelectItem>
                <SelectItem value="reviewed">
                  <span className="flex items-center gap-2">
                    <FileSearch className="w-4 h-4 text-info" />
                    Reviewed
                  </span>
                </SelectItem>
                <SelectItem value="accepted">
                  <span className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-success" />
                    Accepted
                  </span>
                </SelectItem>
                <SelectItem value="rejected">
                  <span className="flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-destructive" />
                    Rejected
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Details Card */}
          <div className="card-elevated p-8 animate-slide-up">
            <h2 className="font-display text-xl font-semibold mb-6">Applicant Details</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-start gap-4 p-4 rounded-lg bg-secondary/50">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Full Name</p>
                  <p className="font-medium">{applicant.full_name}</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-lg bg-secondary/50">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Mail className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email Address</p>
                  <p className="font-medium">{applicant.email}</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-lg bg-secondary/50">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Date of Birth</p>
                  <p className="font-medium">{formatDate(applicant.date_of_birth)}</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-lg bg-secondary/50">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <GraduationCap className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Highest Degree</p>
                  <Badge variant="secondary">{applicant.highest_degree}</Badge>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-lg bg-secondary/50">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Briefcase className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Years of Experience</p>
                  <p className="font-medium">{applicant.years_of_experience} years</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-lg bg-secondary/50">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <BookOpen className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Preferred Course</p>
                  <Badge variant="default">{applicant.preferred_course}</Badge>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-lg bg-secondary/50">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Applied On</p>
                  <p className="font-medium">{formatDate(applicant.created_at)}</p>
                </div>
              </div>
            </div>

            {/* Keyword Match Score */}
            {(applicant.keyword_match_score !== null || (applicant.matched_keywords && applicant.matched_keywords.length > 0)) && (
              <div className="mt-6 p-4 rounded-lg bg-secondary/50">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground mb-2">CV Keyword Match</p>
                    <div className="flex items-center gap-3 mb-3">
                      <Badge 
                       title={
    applicant.matched_keywords && applicant.matched_keywords.length > 0
      ? `Matched: ${applicant.matched_keywords.join(", ")}`
      : "No keywords matched"
  }
                        variant={applicant.keyword_match_score && applicant.keyword_match_score >= 50 ? "default" : "secondary"}
                        className={applicant.keyword_match_score && applicant.keyword_match_score >= 50 ? "bg-success text-lg px-3 py-1" : "text-lg px-3 py-1"}
                      >
                        {applicant.keyword_match_score ?? 0}% Match
                      </Badge>
                    </div>
                    {applicant.matched_keywords && applicant.matched_keywords.length > 0 && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
                          <Tag className="w-3 h-3" />
                          Matched Keywords ({applicant.matched_keywords.length})
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {applicant.matched_keywords.map((keyword, index) => (
                            <Badge key={index} variant="outline" className="capitalize">
                              {keyword}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {applicant.comments && (
              <div className="mt-6 p-4 rounded-lg bg-secondary/50">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <MessageSquare className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground mb-2">Additional Comments</p>
                    <p className="text-foreground whitespace-pre-wrap">{applicant.comments}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApplicantDetail;
