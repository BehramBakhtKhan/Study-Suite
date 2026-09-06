import { useState } from "react";
import { useDocStore, Document } from "@/store/useDocStore";
import { useQuizStore, Quiz } from "@/store/useQuizStore";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB limit

export function useUploadPipeline() {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedDoc, setUploadedDoc] = useState<Document | null>(null);
  const [generatedQuiz, setGeneratedQuiz] = useState<Quiz | null>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const {
    uploadDocument,
    error: docError,
    clearError: clearDocError,
  } = useDocStore();

  const {
    createQuiz,
    error: quizError,
    clearError: clearQuizError,
  } = useQuizStore();

  const selectPdf = (file: File | undefined) => {
    if (!file) return;

    // Type check
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setSelectedFile(null);
      setValidationError("Only PDF files (.pdf) are supported.");
      return;
    }

    // Size check (5MB)
    if (file.size > MAX_FILE_SIZE) {
      setSelectedFile(null);
      setValidationError("File size exceeds the 5MB limit.");
      return;
    }

    setValidationError(null);
    clearDocError();
    setSelectedFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    selectPdf(e.dataTransfer.files?.[0]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    selectPdf(e.target.files?.[0]);
    e.target.value = "";
  };

  const handleUploadAndSummarize = async () => {
    if (!selectedFile) return;

    clearDocError();
    clearQuizError();
    setIsUploading(true);

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      // Direct POST upload parses PDF and returns the summary from Gemini
      const doc = await uploadDocument(formData);
      setUploadedDoc(doc);
    } catch (err) {
      console.error("Document upload pipeline error:", err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleGenerateQuiz = async () => {
    if (!uploadedDoc?.id) return;

    clearQuizError();
    setIsGeneratingQuiz(true);
    try {
      const quiz = await createQuiz(uploadedDoc.id, 5);
      setGeneratedQuiz(quiz);
    } catch (err) {
      console.error("Quiz generation failed:", err);
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  const resetPipeline = () => {
    setSelectedFile(null);
    setUploadedDoc(null);
    setGeneratedQuiz(null);
    setValidationError(null);
    clearDocError();
    clearQuizError();
  };

  return {
    isDragging,
    selectedFile,
    uploadedDoc,
    generatedQuiz,
    isUploading,
    isGeneratingQuiz,
    activeError: validationError || docError || quizError,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFileChange,
    handleUploadAndSummarize,
    handleGenerateQuiz,
    resetPipeline,
  };
}