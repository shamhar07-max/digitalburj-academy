// Curriculum content model — UI renders this; never hardcode course content in components.
export type Check = { question: string; options: string[]; answer: number; why: string };
export type Lesson = {
  id: string; title: string; coldOpen: string; why: string;
  concept: string[]; example: string; practice: string;
  mistakes: string[]; failure: string; exercise: string;
  check: Check; evidence: string; recall?: string;
};
export type Module = { id: string; objective: string; scenario: string; lessons: Lesson[] };
export type Assessment = { kinds: string[]; passNote: string };
export type Course = {
  id: string; title: string; category: string; difficulty: string;
  durationWeeks: number; prerequisites: string[]; audience: string;
  outcomes: string[]; skills: string[]; careers: string[];
  modules: Module[]; finalProject: string; assessment: Assessment;
  evidence: string[]; next: string[]; version: string;
};
