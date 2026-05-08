export interface AudioOfTheDay {
  title: string;
  subtitle: string;
  description?: string;
  audioUrl: string;
}

export interface ContentItem {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  videoUrl?: string; // Optional video URL if clicked
  audioUrl?: string; // Optional audio URL if clicked
  type: 'video' | 'material' | 'game' | 'guardian' | 'desafio' | 'offer';
  duration?: string;
  isCompleted?: boolean;
}

export interface Module {
  id: string;
  title: string;
  description?: string;
  imageUrl: string;
  items: ContentItem[];
  offerId?: string;
  isOffer?: boolean;
  lessonCount?: number;
  requiredPoints?: number;
}

export interface Trail {
  id: string;
  title: string;
  modules: Module[];
  order?: number;
  isExtraContent?: boolean;
  createdAt?: any;
}

export interface NetflixCategory {
  id: string;
  title: string;
  items: (ContentItem | Module)[];
}

export interface CustomLevel {
  id: string;
  title: string;
  points: number;
  maxPoints?: number;
  level: number;
  iconName: string;
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  avatar?: string;
  points: number;
  role: 'admin' | 'student';
  requiresPasswordSetup?: boolean;
  isBlocked?: boolean;
  accessExpiresAt?: string;
  profession?: string;
  instagram?: string;
  phone?: string;
  birthDate?: string;
  maritalStatus?: string;
  hasChildren?: boolean;
  childrenCount?: number;
  lastAudioDate?: string;
  lastMissionRewardDate?: string;
  isCofounder?: boolean;
  completedChallenges?: string[];
  purchasedOfferIds?: string[];
  updatedAt?: any;
}

export interface MonthlyRankingUser {
  uid: string;
  name: string;
  avatar?: string;
  points: number;
  totalPoints?: number;
  isCofounder?: boolean;
}

export interface Offer {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  checkoutUrl: string;
  buttonLabel?: string;
  helperText?: string;
  moduleId?: string;
  lessonCount?: number;
  clickCount?: number;
  createdAt?: any;
  updatedAt?: any;
}

export interface LessonComment {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  userPoints: number;
  userInsignia: string;
  text: string;
  createdAt: any;
  lessonId: string;
}

export interface QuestionDefinition {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'radio' | 'checkbox';
  options?: string[];
}

export interface DailyChallenge {
  id?: string;
  date: string; // DD-MM-YYYY
  title: string;
  description: string;
  questions: QuestionDefinition[];
}

export interface DailyAudio {
  id?: string;
  date: string; // DD-MM-YYYY
  title: string;
  subtitle: string;
  description?: string;
  audioUrl: string;
}

export interface DailyChallengeCompletion {
  id?: string;
  userId: string;
  challengeDate: string;
  audioChecked: boolean;
  responses: Record<string, any>;
  completedAt: any;
}
