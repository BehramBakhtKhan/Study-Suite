export interface User {
  id: string;
  username: string;
  email: string;
  role: "STUDENT" | "ADMIN"; // Inlined union type
}