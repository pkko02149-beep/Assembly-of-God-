import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import TeacherLayout from "@/components/TeacherLayout";
import { getToken } from "@/lib/jwt-api";
import { teacherApi, isAuthError } from "@/lib/jwt-api";
import AiChatInterface, { type AiToolGroup } from "@/components/AiChatInterface";
import { Loader2 } from "lucide-react";

const TEACHER_TOOL_GROUPS: AiToolGroup[] = [
  {
    title: "Lesson Planning",
    tools: [
      { label: "Lesson Plan", icon: "📚", prompt: "Create a detailed lesson plan for Class " },
      { label: "Learning Objectives", icon: "🎯", prompt: "Write clear learning objectives for the topic: " },
      { label: "Teaching Activity", icon: "🧑‍🏫", prompt: "Suggest a classroom activity for teaching " },
    ],
  },
  {
    title: "Homework & Assignments",
    tools: [
      { label: "Homework Ideas", icon: "📝", prompt: "Generate 5 homework assignment ideas for Class " },
      { label: "Project Topic", icon: "🔬", prompt: "Suggest project topics for Class " },
      { label: "Assignment Rubric", icon: "📊", prompt: "Create a grading rubric for " },
    ],
  },
  {
    title: "Assessments",
    tools: [
      { label: "Question Paper", icon: "📄", prompt: "Create a question paper for Class " },
      { label: "MCQ Questions", icon: "✅", prompt: "Generate 10 multiple choice questions on the topic: " },
      { label: "Short Questions", icon: "❓", prompt: "Generate 10 short answer questions on: " },
    ],
  },
  {
    title: "Worksheets",
    tools: [
      { label: "Practice Worksheet", icon: "📋", prompt: "Create a practice worksheet for Class " },
      { label: "Fill in the Blanks", icon: "✏️", prompt: "Create fill-in-the-blank questions for the topic: " },
      { label: "Match the Column", icon: "🔗", prompt: "Create match-the-column exercise for " },
    ],
  },
  {
    title: "Classroom",
    tools: [
      { label: "Classroom Activity", icon: "🎭", prompt: "Suggest an interactive classroom activity for teaching " },
      { label: "Group Activity", icon: "👥", prompt: "Design a group activity for a class of students studying " },
      { label: "Class Discussion", icon: "💬", prompt: "Create discussion questions for the topic: " },
    ],
  },
];

export default function TeacherAiAssistant() {
  const [, navigate] = useLocation();
  const [loading, setLoading] = useState(true);
  const token = getToken("teacher");

  useEffect(() => {
    if (!token) { navigate("/teacher/login"); return; }
    teacherApi.get<{ id: number }>("/auth/teacher/me")
      .catch((err) => { if (isAuthError(err)) navigate("/teacher/login"); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <TeacherLayout title="AI Assistant">
        <div className="flex justify-center h-64 items-center">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
        </div>
      </TeacherLayout>
    );
  }

  return (
    <TeacherLayout title="AI Assistant">
      <div className="flex flex-col gap-3 md:gap-4">
        <div className="hidden md:block">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">AI Assistant</h2>
          <p className="text-sm text-slate-500">
            Teacher AI — Lesson plans, homework, question papers, MCQs, worksheets &amp; classroom activities
          </p>
        </div>
        <AiChatInterface
          toolGroups={TEACHER_TOOL_GROUPS}
          apiPath="/ai/chat"
          authToken={token}
          placeholder="Ask me to create a lesson plan, generate questions, or design classroom activities…"
        />
      </div>
    </TeacherLayout>
  );
}
