import { use, useEffect, useState } from "react";
import { useQuizStore, Question } from "@/store/useQuizStore";


export function useQuizRunner(params: Promise<{ id: string }>) {

  const resolvedParams = use(params);
  const quizId = resolvedParams.id;

  const { activeQuiz, fetchQuizById, submitQuizAttempt, isLoading, error } = useQuizStore();

  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedScore, setSubmittedScore] = useState<number | null>(null);

  useEffect(() => {
    if (quizId) {
      fetchQuizById(quizId);
    }
  }, [quizId, fetchQuizById]);

  const handleSelectOption = (questionId: string, optionIndex: number) => {
    if (submittedScore !== null) return;
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionId]: optionIndex,
    }));
  };

  const handleSubmit = async () => {
    if (!activeQuiz?.questions || !activeQuiz.id) return;
    setIsSubmitting(true);
    try {
      const attempt = await submitQuizAttempt(
        activeQuiz.id,
        activeQuiz.questions,
        selectedAnswers
      );  
      setSubmittedScore(attempt.score);
    } catch (err) {
      console.error("Quiz submission error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const questions: Question[] = activeQuiz?.questions || [];
  const isAnsweredAll = questions.length > 0 && Object.keys(selectedAnswers).length === questions.length;

  return {
    activeQuiz,
    questions,
    selectedAnswers,
    isSubmitting,
    submittedScore,
    isLoading,
    error,
    isAnsweredAll,
    handleSelectOption,
    handleSubmit,
  };
}

