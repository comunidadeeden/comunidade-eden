import React, { useState, useRef, useEffect } from 'react';
import { audioOfTheDay, materiaisDeApoio } from './data';
import { ContentItem, NetflixCategory, Module, Trail, UserProfile, LessonComment, DailyChallenge, DailyAudio, DailyChallengeCompletion, CustomLevel } from './types';
import { Play, Volume2, User, ChevronRight, ChevronLeft, X, Lock, Download, Award, Shield, Compass, FileText, CheckCircle, Star, Trophy, Settings, LayoutDashboard, Video, Plus, Edit2, Trash2, ChevronDown, List, Mic, Users, Camera, Instagram, Briefcase, Phone, Heart, Zap, Crown, Key, Calendar, Leaf, Sprout, ArrowUp, ArrowDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db } from './firebase';
import { isSignInWithEmailLink, onAuthStateChanged, sendSignInLinkToEmail, signInWithEmailAndPassword, signInWithEmailLink, signOut, updatePassword } from 'firebase/auth';
import { doc, getDoc, where, getDocs, collection, setDoc, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, limit, serverTimestamp, increment } from 'firebase/firestore';

export const ICON_MAP: Record<string, React.FC<any>> = {
  Crown, Star, Zap, Award, Trophy, Sprout, Shield, Compass, FileText, CheckCircle, Leaf, Key
};

const INITIAL_TABS = [
  { id: 'jornada', label: 'Início', icon: Compass },
  { id: 'materiais', label: 'Materiais', icon: FileText },
  { id: 'gameficacao', label: 'Desafios', icon: Trophy },
  { id: 'guardiao', label: 'Guardião', icon: Shield },
];

const ADMIN_EMAIL = "gu.correa98@gmail.com";
const EMAIL_FOR_SIGN_IN_KEY = 'edenEmailForSignIn';

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const getInviteIdFromEmail = (email: string) => encodeURIComponent(normalizeEmail(email));

const getEmailLinkActionCodeSettings = () => ({
  url: `${window.location.origin}${window.location.pathname}`,
  handleCodeInApp: true,
});

const getVideoThumbnail = (url: string | undefined) => {
  if (!url) return '';
  const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
  const match = url.match(youtubeRegex);
  if (match && match[1]) {
    return `https://img.youtube.com/vi/${match[1]}/maxresdefault.jpg`;
  }
  return '';
};

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

const JOURNEY_LEVELS = [
  {
    id: 'fase1',
    title: 'Fase 1: O Início do Despertar',
    tasks: [
      { id: 'etapa1', title: 'O Chamado', description: 'Aceite seu destino e dê o primeiro passo. Descreva o que te trouxe até aqui.', reward: 50 },
      { id: 'etapa2', title: 'A Luz do Sol', description: 'Encontre a clareza nas primeiras sombras. Qual a sua maior realização hoje?', reward: 100 },
      { id: 'etapa3', title: 'O Rio da Vida', description: 'Deixe fluir e limpe os obstáculos. O que você escolhe deixar para trás?', reward: 150 },
      { id: 'etapa4', title: 'A Raiz Profunda', description: 'Conecte-se com as raízes mais profundas. Qual a sua base mais forte?', reward: 200 },
    ]
  },
  {
    id: 'fase2',
    title: 'Fase 2: Caminhos Sinuosos',
    tasks: [
      { id: 'etapa5', title: 'A Caverna Escura', description: 'Enfrente seus medos no escuro. Qual é o seu maior obstáculo hoje?', reward: 250 },
      { id: 'etapa6', title: 'O Cume da Montanha', description: 'A visão do topo de tudo. Onde você quer chegar ao final dessa jornada?', reward: 300 },
      { id: 'etapa7', title: 'Os Ventos da Mudança', description: 'Sinta a transformação no ar. O que mudou em você recentemente?', reward: 350 },
      { id: 'etapa8', title: 'O Fogo Interior', description: 'Encontre sua paixão. O que te move a continuar?', reward: 400 },
    ]
  },
  {
    id: 'fase3',
    title: 'Fase 3: Domínio do Éden',
    tasks: [
      { id: 'etapa9', title: 'O Templo das Sombras', description: 'Abrace a dualidade. O que você aprendeu com seus erros?', reward: 450 },
      { id: 'etapa10', title: 'O Lago Sereno', description: 'Um momento de paz. Descreva um momento tranquilo recente.', reward: 500 },
      { id: 'etapa11', title: 'A Árvore da Vida', description: 'Conhecimento supremo. Qual sua maior revelação?', reward: 600 },
      { id: 'etapa12', title: 'Guardião do Jardim', description: 'Proteja o que conquistou. Como você manterá esse equilíbrio?', reward: 700 },
    ]
  }
];

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const isAdmin = user?.role === 'admin' || user?.email === ADMIN_EMAIL;
  
  const [userLevels, setUserLevels] = useState<CustomLevel[]>([
    { id: '1', title: 'Guardiã do Éden', points: 2000, level: 5, iconName: 'Crown' },
    { id: '2', title: 'Decidida', points: 1200, level: 4, iconName: 'Star' },
    { id: '3', title: 'Ruptura', points: 750, level: 3, iconName: 'Zap' },
    { id: '4', title: 'Desperta', points: 550, level: 2, iconName: 'Award' },
    { id: '5', title: 'Observadora', points: 300, level: 1, iconName: 'Trophy' },
    { id: '6', title: 'Iniciante', points: 0, level: 0, iconName: 'Sprout' }
  ]);

  const getUserLevel = (points: number) => {
    const sortedLevels = [...userLevels].sort((a, b) => b.points - a.points);
    const levelObj = sortedLevels.find(l => points >= l.points) || sortedLevels[sortedLevels.length - 1];
    return { title: levelObj?.title || 'Iniciante', level: levelObj?.level || 0, icon: ICON_MAP[levelObj?.iconName] || Trophy };
  };

  const getNextLevelInfo = (points: number) => {
    const sortedLevels = [...userLevels].sort((a, b) => b.points - a.points);
    const reversed = [...sortedLevels].reverse(); // from 0 up
    const currentIdx = reversed.findIndex(l => points < l.points);
    if (currentIdx === -1 || (currentIdx === 0 && points >= reversed[reversed.length - 1].points)) {
      return { nextTitle: 'Nível Máximo Alcançado', percentage: 100 };
    }
    const nextLevel = reversed[currentIdx];
    const prevLevel = reversed[currentIdx - 1] || { points: 0 };
    return { 
       nextTitle: nextLevel.title, 
       percentage: ((points - prevLevel.points) / (nextLevel.points - prevLevel.points)) * 100 
    };
  };

  const [activeTab, setActiveTab] = useState('jornada');
  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  // Admin UI state
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [adminActiveSection, setAdminActiveSection] = useState('geral');
  const [editingMission, setEditingMission] = useState<DailyChallenge | null>(null);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [adminStudents, setAdminStudents] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [isFolhasModalOpen, setIsFolhasModalOpen] = useState(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isMissionModalOpen, setIsMissionModalOpen] = useState(false);
  const [missionResponses, setMissionResponses] = useState<Record<string, string | string[]>>({});
  const [audioChecked, setAudioChecked] = useState(false);
  const [isSubmittingMission, setIsSubmittingMission] = useState(false);
  const [leavesAmount, setLeavesAmount] = useState(0);
  const [resetEmailSent, setResetEmailSent] = useState<string | null>(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginInfo, setLoginInfo] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [emailLinkConfirmationEmail, setEmailLinkConfirmationEmail] = useState('');
  const [isCompletingEmailLink, setIsCompletingEmailLink] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [passwordSetupError, setPasswordSetupError] = useState('');
  const [isSettingPassword, setIsSettingPassword] = useState(false);

  const sendLoginLink = async (email: string) => {
    const normalizedEmail = normalizeEmail(email);
    await sendSignInLinkToEmail(auth, normalizedEmail, getEmailLinkActionCodeSettings());
    window.localStorage.setItem(EMAIL_FOR_SIGN_IN_KEY, normalizedEmail);
    setResetEmailSent(normalizedEmail);
    setTimeout(() => setResetEmailSent(null), 5000);
  };

  const handleSendAccessLink = async (email: string) => {
    try {
      await sendLoginLink(email);
    } catch (error) {
      console.error("Error sending access link:", error);
      alert("Erro ao enviar email de acesso.");
    }
  };

  const handleCreateStudent = async (data: Record<string, string>) => {
    const email = normalizeEmail(data.email || '');
    const name = data.name?.trim();

    if (!email || !name) {
      alert('Informe nome e email do aluno.');
      return;
    }

    try {
      await setDoc(doc(db, 'studentInvites', getInviteIdFromEmail(email)), {
        email,
        name,
        role: 'student',
        invitedBy: user?.uid || '',
        status: 'invited',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      await sendLoginLink(email);
      alert(`Convite criado. Enviamos o link de primeiro acesso para ${email}.`);
    } catch (error) {
      console.error('Error creating student invite:', error);
      alert('Erro ao criar convite. Confira as regras do Firestore e se o login por link de email está habilitado no Firebase Authentication.');
    }
  };

  const handleUpdateLeaves = async () => {
    if (!selectedUser) return;
    try {
      await updateDoc(doc(db, 'users', selectedUser.uid), {
        points: (selectedUser.points || 0) + leavesAmount
      });
      setIsFolhasModalOpen(false);
      setLeavesAmount(0);
    } catch (error) {
      console.error("Error updating leaves:", error);
    }
  };

  const handleUpdateRole = async (role: 'admin' | 'student') => {
    if (!selectedUser) return;
    try {
      await updateDoc(doc(db, 'users', selectedUser.uid), { role });
      setIsRoleModalOpen(false);
    } catch (error) {
      console.error("Error updating role:", error);
    }
  };

  const toggleChallengeCompletion = async (challengeId: string) => {
    if (!user) return;
    
    const isCompleted = user.completedChallenges?.includes(challengeId);
    let newCompletedChallenges = [...(user.completedChallenges || [])];
    let pointsToAdd = 0;

    if (isCompleted) {
      newCompletedChallenges = newCompletedChallenges.filter(id => id !== challengeId);
      pointsToAdd = -7;
    } else {
      newCompletedChallenges.push(challengeId);
      pointsToAdd = 7;
    }

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        completedChallenges: newCompletedChallenges,
        points: (user.points || 0) + pointsToAdd,
        updatedAt: serverTimestamp()
      });
      setUser({
        ...user,
        completedChallenges: newCompletedChallenges,
        points: Math.max(0, (user.points || 0) + pointsToAdd)
      });
    } catch (error) {
      console.error("Error updating challenge completion:", error);
    }
  };

  // Content state
  const [trailsState, setTrailsState] = useState<Trail[]>([]);
  const [selectedModule, setSelectedModule] = useState<Module | null>(null);
  const [selectedTrail, setSelectedTrail] = useState<Trail | null>(null);
  const [selectedLessonChallenge, setSelectedLessonChallenge] = useState<ContentItem | null>(null);
  const [dailyChallenges, setDailyChallenges] = useState<DailyChallenge[]>([]);
  const [allCompletions, setAllCompletions] = useState<DailyChallengeCompletion[]>([]);
  const [todayChallenge, setTodayChallenge] = useState<DailyChallenge | null>(null);
  const [allAudios, setAllAudios] = useState<DailyAudio[]>([]);
  const [editingAudio, setEditingAudio] = useState<DailyAudio | null>(null);
  const [rankingUsers, setRankingUsers] = useState<UserProfile[]>([]);
  const [currentLessonIndex, setCurrentLessonIndex] = useState(0);
  const [commentInput, setCommentInput] = useState('');
  const [comments, setComments] = useState<LessonComment[]>([]);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  const activeLesson = selectedModule?.items[currentLessonIndex];
  const [materiaisState, setMateriaisState] = useState(materiaisDeApoio);
  const [audioState, setAudioState] = useState(audioOfTheDay);
  
  // Admin settings for tab visibility
  const [tabVisibility, setTabVisibility] = useState({
    jornada: true,
    materiais: true,
    gameficacao: true,
    guardiao: true,
  });

  type PromptConfig = {
    title: string;
    description?: string;
    fields: { name: string, label: string, type?: string, defaultValue?: string, required?: boolean, placeholder?: string }[];
    submitText?: string;
    onSubmit: (data: Record<string, string>) => void;
    onCancel: () => void;
  };
  const [promptConfig, setPromptConfig] = useState<PromptConfig | null>(null);

  // Use all tabs, but we will handle disabled state in content rendering
  const userTabs = INITIAL_TABS;

  // Gamification states
  const [leaves, setLeaves] = useState(0);
  const [completedChallenges, setCompletedChallenges] = useState<string[]>([]);
  
  // -- FIRESTORE ERROR HANDLER --
  const handleFirestoreError = (error: any, operationType: OperationType | string, path: string | null) => {
    const errInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified,
      },
      operationType,
      path
    };
    console.error('Firestore Error:', JSON.stringify(errInfo));
    // Optionally show a silent notification to UI
  };

	  useEffect(() => {
	    if (!isSignInWithEmailLink(auth, window.location.href)) return;

	    const storedEmail = window.localStorage.getItem(EMAIL_FOR_SIGN_IN_KEY);
	    if (!storedEmail) {
	      setEmailLinkConfirmationEmail('');
	      setLoginInfo('Confirme seu email para concluir o acesso.');
	      setLoading(false);
	      return;
	    }

	    setIsCompletingEmailLink(true);
	    signInWithEmailLink(auth, storedEmail, window.location.href)
	      .then(() => {
	        window.localStorage.removeItem(EMAIL_FOR_SIGN_IN_KEY);
	        window.history.replaceState({}, document.title, window.location.pathname);
	      })
	      .catch((error) => {
	        console.error('Error completing email link sign-in:', error);
	        setLoginError('Link inválido ou expirado. Solicite um novo acesso.');
	        setLoading(false);
	      })
	      .finally(() => setIsCompletingEmailLink(false));
	  }, []);

	  const completeEmailLinkSignIn = async (email: string) => {
	    const normalizedEmail = normalizeEmail(email);
	    if (!normalizedEmail || !isSignInWithEmailLink(auth, window.location.href)) {
	      setLoginError('Informe o email usado para receber o link.');
	      return;
	    }

	    setIsCompletingEmailLink(true);
	    setLoginError('');
	    try {
	      await signInWithEmailLink(auth, normalizedEmail, window.location.href);
	      window.localStorage.removeItem(EMAIL_FOR_SIGN_IN_KEY);
	      window.history.replaceState({}, document.title, window.location.pathname);
	    } catch (error) {
	      console.error('Error completing email link sign-in:', error);
	      setLoginError('Não foi possível confirmar esse link. Verifique o email ou solicite um novo acesso.');
	    } finally {
	      setIsCompletingEmailLink(false);
	    }
	  };

	  useEffect(() => {
	    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
	      if (authUser) {
	        try {
	          // Fetch or create user profile
	          const userDoc = await getDoc(doc(db, 'users', authUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data() as UserProfile;
            // Ensure points field exists for filtering/ordering
            if (userData.points === undefined) {
              await updateDoc(doc(db, 'users', authUser.uid), { points: 0 });
              userData.points = 0;
            }
            setUser(userData);
            setLeaves(userData.points);
	          } else {
	            const inviteDoc = authUser.email
	              ? await getDoc(doc(db, 'studentInvites', getInviteIdFromEmail(authUser.email)))
	              : null;
	            const inviteData = inviteDoc?.exists() ? inviteDoc.data() : null;
	            if (authUser.email !== ADMIN_EMAIL && !inviteData) {
	              setLoginError('Acesso não autorizado. Entre em contato com o suporte do Éden.');
	              await signOut(auth);
	              setLoading(false);
	              return;
	            }
	            const newUser: UserProfile = {
	              uid: authUser.uid,
	              email: authUser.email || '',
	              name: (inviteData?.name as string) || authUser.displayName || 'Usuário',
	              avatar: authUser.photoURL || '',
	              points: 0,
	              role: authUser.email === ADMIN_EMAIL ? 'admin' : ((inviteData?.role as 'admin' | 'student') || 'student'),
	              requiresPasswordSetup: authUser.email !== ADMIN_EMAIL,
	              profession: '',
	              instagram: '',
	              phone: '',
              maritalStatus: '',
              hasChildren: false,
              childrenCount: 0,
	              updatedAt: serverTimestamp()
	            };
	            await setDoc(doc(db, 'users', authUser.uid), newUser);
	            if (inviteDoc?.exists()) {
	              await updateDoc(doc(db, 'studentInvites', inviteDoc.id), {
	                status: 'accepted',
	                acceptedBy: authUser.uid,
	                acceptedAt: serverTimestamp(),
	                updatedAt: serverTimestamp()
	              });
	            }
	            setUser(newUser);
	          }
        } catch (error) {
          handleFirestoreError(error, 'GET/WRITE', `users/${authUser?.uid}`);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    // Real-time trails/modules listener
    const unsubscribeTrails = onSnapshot(query(collection(db, 'trails'), orderBy('order')), (snapshot) => {
       const trailsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
       setTrailsState(trailsData.length > 0 ? trailsData : [
        {
          id: 'trail-1',
          title: 'Trilha Principal',
          modules: [
            {
              id: 'mod-bem-vinda',
              title: 'Bem-Vinda ao Éden',
              imageUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=80&w=600&h=900',
              items: [
                { id: 'l1', title: 'Bem Vinda', description: '', imageUrl: '', type: 'video', videoUrl: 'https://play.tynk.ai/p/77447fb5-f24e-43c4-b1a8-4f3917c4dace' },
                { id: 'l2', title: 'Recados importantes', description: '', imageUrl: '', type: 'video', videoUrl: 'https://play.tynk.ai/p/77447fb5-f24e-43c4-b1a8-4f3917c4dace' },
                { id: 'l3', title: 'Conheça o Guardião', description: '', imageUrl: '', type: 'video', videoUrl: 'https://play.tynk.ai/p/77447fb5-f24e-43c4-b1a8-4f3917c4dace' },
              ]
            }
          ]
        }
       ]);
    }, (error) => {
      handleFirestoreError(error, 'LIST', 'trails');
    });

    const unsubscribeMaterials = onSnapshot(collection(db, 'materials'), (snapshot) => {
      const materialsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setMateriaisState([{
        id: "pdfs",
        title: "Materiais Complementares",
        items: materialsData.length > 0 ? materialsData : materiaisDeApoio[0].items
      }]);
    }, (error) => {
      handleFirestoreError(error, 'LIST', 'materials');
    });

    let unsubscribeStudents: (() => void) | null = null;

    if (isAdmin) {
      unsubscribeStudents = onSnapshot(collection(db, 'users'), (snapshot) => {
        const studentsData = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
        setAdminStudents(studentsData);
      }, (error) => {
        handleFirestoreError(error, 'LIST', 'users');
      });
    }

    return () => {
      unsubscribeTrails();
      unsubscribeMaterials();
      if (unsubscribeStudents) unsubscribeStudents();
    };
  }, [user, isAdmin]);

  useEffect(() => {
    if (!selectedModule || !activeLesson) return;

    const q = query(
      collection(db, 'comments'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeComments = onSnapshot(q, (snapshot) => {
      const allComments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LessonComment));
      // In a real app we'd filter by lessonId in the query, but for simplicity let's filter here or use a specific subcollection
      setComments(allComments.filter(c => c.lessonId === activeLesson.id));
    }, (error) => {
      handleFirestoreError(error, 'LIST', 'comments');
    });

    return () => unsubscribeComments();
  }, [selectedModule, activeLesson]);

    useEffect(() => {
    if (!user) return; // Only listen if we have a user

    // Fetch today's challenge
    const today = new Date().toLocaleDateString('pt-BR').split('/').join('-');
    const challengeRef = doc(db, 'dailyChallenges', today);
    const unsubscribeChallenge = onSnapshot(challengeRef, (doc) => {
      if (doc.exists()) {
        setTodayChallenge({ id: doc.id, ...doc.data() } as DailyChallenge);
      } else {
        setTodayChallenge(null);
      }
    }, (error) => {
      handleFirestoreError(error, 'GET' as any, 'dailyChallenges');
    });

    // Fetch today's audio
    const audioRefDoc = doc(db, 'dailyAudios', today);
    const unsubscribeTodayAudio = onSnapshot(audioRefDoc, (docC) => {
       if (docC.exists()) {
         setAudioState(docC.data() as DailyAudio);
       } else {
         setAudioState(audioOfTheDay); // fallback
       }
    }, (error) => {
      handleFirestoreError(error, 'GET' as any, 'dailyAudios');
    });

    // Fetch all challenges for admin
    const challengesRef = collection(db, 'dailyChallenges');
    const qChallenges = query(challengesRef, orderBy('createdAt', 'desc'));
    const unsubscribeAllChallenges = onSnapshot(qChallenges, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyChallenge));
      setDailyChallenges(docs);
    }, (error) => {
      handleFirestoreError(error, 'LIST' as any, 'dailyChallenges');
    });

    // Fetch completions (filtered by user if not admin, all if admin)
    const completionsRef = collection(db, 'dailyChallengeCompletions');
    const completionsQuery = isAdmin ? completionsRef : query(completionsRef, where('userId', '==', user.uid));
    const unsubscribeAllCompletions = onSnapshot(completionsQuery, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyChallengeCompletion));
      setAllCompletions(docs);
    }, (error) => {
      if (error.code !== 'permission-denied') { // Incase rule fails transiently
         console.error(error);
      }
    });

    // Fetch all audios for admin
    const audiosRefCol = collection(db, 'dailyAudios');
    const qAudios = query(audiosRefCol, orderBy('createdAt', 'desc'));
    const unsubscribeAllAudios = onSnapshot(qAudios, (snapshot) => {
       const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyAudio));
       setAllAudios(docs);
    }, (error) => {
      handleFirestoreError(error, 'LIST' as any, 'dailyAudios');
    });

    // Fetch Ranking (Top 5)
    const usersRef = collection(db, 'users');
    const qRanking = query(usersRef, orderBy('points', 'desc'), limit(5));
    const unsubscribeRanking = onSnapshot(qRanking, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      setRankingUsers(docs);
    }, (error) => {
      handleFirestoreError(error, 'LIST' as any, 'users');
    });

    const unsubscribeLevels = onSnapshot(doc(db, 'settings', 'levels'), (docLevel) => {
       if (docLevel.exists()) {
          const data = docLevel.data();
          if (data.levels && Array.isArray(data.levels)) {
             setUserLevels(data.levels);
          }
       }
    }, (error) => {
      handleFirestoreError(error, 'GET' as any, 'settings/levels');
    });

    return () => {
      unsubscribeChallenge();
      unsubscribeTodayAudio();
      unsubscribeAllChallenges();
      unsubscribeAllCompletions();
      unsubscribeAllAudios();
      unsubscribeRanking();
      unsubscribeLevels();
    };
  }, [user?.uid, isAdmin]);

  const handleAddComment = async () => {
    if (!user || !activeLesson || !commentInput.trim()) return;

    setIsSubmittingComment(true);
    try {
      const userLevel = getUserLevel(user.points || 0);
      const newComment = {
        userId: user.uid,
        userName: user.name,
        userAvatar: user.avatar,
        userPoints: user.points || 0,
        userInsignia: userLevel.title,
        text: commentInput,
        lessonId: activeLesson.id,
        createdAt: serverTimestamp(),
      };

      await setDoc(doc(collection(db, 'comments')), newComment);
      setCommentInput('');
    } catch (error) {
      handleFirestoreError(error, 'CREATE', 'comments');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleUpdatePoints = async (userId: string, newPoints: number) => {
    try {
      await updateDoc(doc(db, 'users', userId), { points: newPoints, updatedAt: serverTimestamp() });
    } catch (error) {
      handleFirestoreError(error, 'UPDATE', `users/${userId}`);
    }
  };

  const handleLogin = async () => {
    if (!loginEmail.trim() || !loginPassword) {
      setLoginError('Informe email e senha para entrar.');
      return;
    }

    setIsLoggingIn(true);
    setLoginError('');
    setLoginInfo('');
    try {
      await signInWithEmailAndPassword(auth, normalizeEmail(loginEmail), loginPassword);
    } catch (e: any) {
      console.error(e);
      setLoginError('Email ou senha inválidos. Verifique seus dados e tente novamente.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSetInitialPassword = async () => {
    if (!auth.currentUser || !user) return;
    if (newPassword.length < 8) {
      setPasswordSetupError('A senha precisa ter pelo menos 8 caracteres.');
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      setPasswordSetupError('As senhas não conferem.');
      return;
    }

    setIsSettingPassword(true);
    setPasswordSetupError('');
    try {
      await updatePassword(auth.currentUser, newPassword);
      await updateDoc(doc(db, 'users', user.uid), {
        requiresPasswordSetup: false,
        updatedAt: serverTimestamp()
      });
      setUser({ ...user, requiresPasswordSetup: false });
      setNewPassword('');
      setNewPasswordConfirm('');
    } catch (error) {
      console.error('Error setting initial password:', error);
      setPasswordSetupError('Não foi possível salvar a senha. Abra novamente o link recebido por email e tente de novo.');
    } finally {
      setIsSettingPassword(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setAdminActiveSection('geral');
      setIsAdminPanelOpen(false);
      setActiveTab('jornada');
    } catch (e) {
      console.error(e);
    }
  };

  const renderProfileTab = () => {
    if (!user) return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <h2 className="text-2xl font-bold mb-4">Você precisa estar logado</h2>
        <button onClick={() => setActiveTab('jornada')} className="bg-emerald-500 text-black px-8 py-3 rounded-xl font-bold">Ir para o Login</button>
      </div>
    );

    return (
	      <div className="max-w-2xl mx-auto py-6 sm:py-10 px-0 sm:px-4 pb-32">
	        <div className="bg-white/5 border border-white/10 rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl">
          <div className="h-32 bg-gradient-to-r from-[#0b2831] via-[#144b5c] to-[#4bd3ff]/20"></div>
	          <div className="px-4 sm:px-8 pb-8">
	            <div className="relative -mt-14 sm:-mt-16 mb-6 flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-6">
	              <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl sm:rounded-none bg-[#020507] border-4 border-[#020507] overflow-hidden shadow-xl group relative">
                {user.avatar ? (
                  <img src={user.avatar} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-800 text-gray-500">
                    <User size={48} />
                  </div>
                )}
                <div 
                   onClick={() => {
                     setPromptConfig({
                       title: 'Alterar Foto',
                       fields: [{ name: 'url', label: 'Cole a URL da sua nova foto', defaultValue: user.avatar || '' }],
                       onSubmit: (data) => {
                         if (data.url) {
                            setUser({...user, avatar: data.url});
                            updateDoc(doc(db, 'users', user.uid), { avatar: data.url });
                         }
                       },
                       onCancel: () => setPromptConfig(null)
                     });
                   }}
                   className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                >
                  <Camera size={24} className="text-white" />
                </div>
              </div>
	              <div className="pb-2 flex-1 min-w-0">
                <input 
                  type="text" 
                  value={user.name} 
                  onChange={(e) => setUser({...user, name: e.target.value})}
	                  className="text-2xl sm:text-3xl font-black text-white tracking-tight bg-transparent border-b border-transparent focus:border-[#4bd3ff] focus:outline-none w-full"
                />
	                <p className="text-gray-400 font-medium break-all text-sm sm:text-base">{user.email}</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                    <Briefcase size={14} /> Profissão
                  </label>
                  <input 
                    type="text" 
                    value={user.profession || ''}
                    onChange={(e) => setUser({...user, profession: e.target.value})}
                    placeholder="Ex: Engenheira, Médica..."
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-[#4bd3ff] transition-colors" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                    <Instagram size={14} /> Instagram (@)
                  </label>
                  <input 
                    type="text" 
                    value={user.instagram || ''}
                    onChange={(e) => setUser({...user, instagram: e.target.value})}
                    placeholder="@seuinsta"
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-[#4bd3ff] transition-colors" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                    <Phone size={14} /> Telefone / WhatsApp
                  </label>
                  <input 
                    type="text" 
                    value={user.phone || ''}
                    onChange={(e) => setUser({...user, phone: e.target.value})}
                    placeholder="(00) 00000-0000"
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-[#4bd3ff] transition-colors" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                    <Heart size={14} /> Estado Civil
                  </label>
                  <select 
                    value={user.maritalStatus || ''}
                    onChange={(e) => setUser({...user, maritalStatus: e.target.value})}
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-[#4bd3ff] transition-colors appearance-none"
                  >
                    <option value="">Selecione...</option>
                    <option value="solteiro">Solteiro(a)</option>
                    <option value="casado">Casado(a)</option>
                    <option value="divorciado">Divorciado(a)</option>
                    <option value="viuvo">Viúvo(a)</option>
                    <option value="uniao_estavel">União Estável</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                    <Users size={14} /> Filhos
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-white cursor-pointer">
                      <input 
                        type="radio" 
                        checked={user.hasChildren === true} 
                        onChange={() => setUser({...user, hasChildren: true})}
                        className="accent-[#4bd3ff]"
                      /> Sim
                    </label>
                    <label className="flex items-center gap-2 text-white cursor-pointer">
                      <input 
                        type="radio" 
                        checked={user.hasChildren === false} 
                        onChange={() => setUser({...user, hasChildren: false, childrenCount: 0})}
                        className="accent-[#4bd3ff]"
                      /> Não
                    </label>
                  </div>
                </div>
                {user.hasChildren && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                      Quantidade de Filhos
                    </label>
                    <input 
                      type="number" 
                      value={user.childrenCount || 0}
                      onChange={(e) => setUser({...user, childrenCount: parseInt(e.target.value) || 0})}
                      className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-[#4bd3ff] transition-colors" 
                    />
                  </div>
                )}
              </div>

	              <div className="p-5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Seu Saldo</p>
                  <div className="flex items-center gap-1.5">
                    <span className="text-2xl">🍃</span>
                    <span className="text-2xl font-black text-white">{user.points} Folhas</span>
                  </div>
                </div>
	                <div className="sm:text-right">
                  <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Nível Atual</p>
                  <p className="text-lg font-bold text-white capitalize">{user.role}</p>
                </div>
              </div>

              <div className="pt-4 space-y-4">
                <button 
                    onClick={async () => {
                      if (!user) return;
                      try {
                        await updateDoc(doc(db, 'users', user.uid), {
                          name: user.name,
                          avatar: user.avatar || '',
                          profession: user.profession || '',
                          instagram: user.instagram || '',
                          phone: user.phone || '',
                          maritalStatus: user.maritalStatus || '',
                          hasChildren: !!user.hasChildren,
                          childrenCount: user.childrenCount || 0,
                          updatedAt: serverTimestamp()
                        });
                        // alert('Perfil atualizado!');
                      } catch (error) {
                        handleFirestoreError(error, 'UPDATE', `users/${user.uid}`);
                      }
                    }}
                    className="w-full bg-gradient-to-r from-[#4bd3ff] to-[#0ea5e9] text-white py-4 rounded-xl font-black uppercase tracking-widest shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 transition-all active:scale-95"
                >
                  Salvar Alterações
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };
  // Finding active level index based on progress
  const activeLevelIndex = JOURNEY_LEVELS.findIndex(level => 
    !level.tasks.every(t => completedChallenges.includes(t.id))
  );
  
  const currentLevelIndex = activeLevelIndex === -1 ? JOURNEY_LEVELS.length - 1 : activeLevelIndex;
  const activeLevel = JOURNEY_LEVELS[currentLevelIndex];
  
  // Progress within the current level
  const completedInCurrentLevel = activeLevel.tasks.filter(t => completedChallenges.includes(t.id)).length;
  const progressToNextLevel = (completedInCurrentLevel / activeLevel.tasks.length) * 100;

  const toggleAudio = async () => {
    if (audioRef.current) {
      if (isPlayingAudio) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
        const today = new Date().toLocaleDateString('pt-BR').split('/').join('-');
        if (user && user.lastAudioDate !== today) {
           try {
	              await updateDoc(doc(db, 'users', user.uid), {
	                 points: increment(5),
	                 lastAudioDate: today,
	                 updatedAt: serverTimestamp()
	              });
           } catch(e) {
              handleFirestoreError(e, OperationType.UPDATE, `users/${user.uid}`);
           }
        }
      }
      setIsPlayingAudio(!isPlayingAudio);
    }
  };

  const handleSubmitMission = async () => {
    if (!user || !todayChallenge) return;

    if (!audioChecked) {
      alert('Você precisa confirmar que ouviu o áudio da missão!');
      return;
    }

    // Identify if all questions are answered
    for (const q of todayChallenge.questions || []) {
      const resp = missionResponses[q.id];
      if (!resp || (Array.isArray(resp) && resp.length === 0)) {
        alert(`A pergunta "${q.label}" é obrigatória.`);
        return;
      }
    }

    setIsSubmittingMission(true);
    try {
      const completionId = `${user.uid}_${todayChallenge.date}`;
      await setDoc(doc(db, 'dailyChallengeCompletions', completionId), {
        userId: user.uid,
        challengeDate: todayChallenge.date,
        audioChecked,
        responses: missionResponses,
        completedAt: serverTimestamp()
      });

      // Award 30 points
	      await updateDoc(doc(db, 'users', user.uid), {
	        points: increment(30),
	        lastMissionRewardDate: todayChallenge.date,
	        updatedAt: serverTimestamp()
	      });

      setIsMissionModalOpen(false);
      setAudioChecked(false);
      setMissionResponses({});
      alert('Parabéns! Missão concluída com sucesso. +30 Folhas');
    } catch (e) {
      handleFirestoreError(e, 'WRITE', 'dailyChallengeCompletions');
    } finally {
      setIsSubmittingMission(false);
    }
  };


  const renderAudioCard = () => (
    <div className="relative group cursor-pointer w-full max-w-lg mx-auto" onClick={toggleAudio}>
      <div className="absolute inset-0 bg-gradient-to-r from-[#4bd3ff]/10 to-[#0b2831]/20 rounded-xl blur-lg group-hover:blur-xl transition-all duration-500 opacity-40"></div>
      <div className="relative bg-white/5 backdrop-blur-2xl border border-white/5 p-2 sm:p-3 rounded-xl shadow-2xl flex items-center gap-3 transition-all duration-300 hover:bg-white/10 hover:border-white/10 hover:-translate-y-0.5">
        <button className="w-10 h-10 shrink-0 rounded-lg bg-gradient-to-tr from-[#0b2831] to-[#4bd3ff]/10 border border-white/5 text-white flex items-center justify-center transition-transform duration-300 group-hover:scale-105">
          {isPlayingAudio ? <Volume2 size={16} className="text-[#4bd3ff]" /> : <Play size={16} className="translate-x-0.5 fill-white" />}
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[8px] text-[#4bd3ff] font-bold uppercase tracking-[0.2em] truncate mb-0.5">
            {audioState.subtitle || 'Mensagem do Guardião'}
          </p>
          <h3 className="text-sm font-black text-white truncate tracking-tight">{audioState.title || audioOfTheDay.title}</h3>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    const currentTab = INITIAL_TABS.find(t => t.id === activeTab);
    if (!isAdmin && currentTab && !tabVisibility[activeTab as keyof typeof tabVisibility]) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in duration-500 min-h-[70vh]">
          <div className="w-24 h-24 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center mb-6 relative">
            <div className="absolute inset-0 bg-[#4bd3ff]/20 blur-2xl rounded-full"></div>
            {currentTab.icon && <currentTab.icon size={48} className="text-gray-500 relative z-10" />}
            <div className="absolute -bottom-2 -right-2 bg-yellow-500/20 border border-yellow-500/50 text-yellow-500 p-1.5 rounded-lg z-20">
              <Settings size={16} className="animate-spin-slow" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-2">{currentTab.label}</h3>
          <p className="text-gray-400 font-medium max-w-xs leading-relaxed">
            Esta funcionalidade está sendo preparada com carinho e logo estará disponível para sua jornada no Éden.
          </p>
          <div className="mt-8 px-6 py-2.5 bg-white/5 border border-white/10 rounded-full text-[10px] font-black text-[#4bd3ff] uppercase tracking-[0.3em] shadow-xl">
            Despertando o Recurso
          </div>
        </div>
      );
    }

    switch(activeTab) {
      case 'jornada':
        return (
          <div className="max-w-4xl mx-auto flex flex-col gap-10 pt-4 px-4 pb-20">
            {renderAudioCard()}
            {/* Home tab showing Trails instead of simple categories */}
            <div className="space-y-8">
              <div className="space-y-4">
                {trailsState.map(trail => (
                  <TrailRow 
                    key={trail.id} 
                    trail={trail} 
                    user={user}
                    onSelectModule={(mod, index) => {
                      const item = mod.items[index || 0];
                      if (item?.type === 'desafio') {
                        setSelectedLessonChallenge(item);
                      } else {
                        setSelectedTrail(trail);
                        setSelectedModule(mod);
                        setCurrentLessonIndex(index || 0);
                      }
                    }} 
                  />
                ))}
              </div>
            </div>
          </div>
        );
      case 'perfil':
        return renderProfileTab();
      case 'materiais':
        return (
          <div className="max-w-4xl mx-auto flex flex-col gap-10 pt-4">
            {renderAudioCard()}
            <div className="space-y-4">
              {materiaisState.map(cat => (
                <CategoryRow 
                  key={cat.id} 
                  category={cat} 
                  onSelect={(item) => {
                    const contentItem = item as ContentItem;
                    if (contentItem.videoUrl) {
                      window.open(contentItem.videoUrl, '_blank', 'noopener,noreferrer');
                    } else if (contentItem.audioUrl) {
                       window.open(contentItem.audioUrl, '_blank', 'noopener,noreferrer');
                    } else {
                      setSelectedItem(item);
                    }
                  }} 
                />
              ))}
            </div>
          </div>
        );
      case 'gameficacao': {
        return (
          <div className="max-w-4xl mx-auto py-12 px-4 space-y-16">
            {/* Missão do Dia - Simplified Section */}
            <section className="space-y-6">
              <div className="flex items-center gap-4 mb-8">
                <div className="p-3 bg-[#4bd3ff]/10 border border-[#4bd3ff]/20 rounded-none text-[#4bd3ff]">
                  <Zap size={24} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-white uppercase tracking-tight">Missão do Dia</h3>
                  <p className="text-gray-400 text-sm">Cumpra os protocolos diários para ganhar folhas.</p>
                </div>
              </div>

              {todayChallenge ? (() => {
                const isCompleted = allCompletions.some(c => c.challengeDate === todayChallenge.date && (isAdmin ? c.userId === user?.uid : true));
                return (
                <div className="bg-[#040e11] border border-white/10 p-8 rounded-none shadow-xl flex flex-col md:flex-row items-center gap-8 group relative overflow-hidden">
                  {isCompleted && (
                     <div className="absolute top-0 right-0 p-4 bg-emerald-500/10 rounded-bl-3xl">
                        <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-widest">
                           <CheckCircle size={16} /> Missão Concluída
                        </div>
                     </div>
                  )}
                  <div className="flex-1 space-y-4 relative z-10">
                    <h4 className="text-2xl font-black text-[#4bd3ff] uppercase tracking-tight group-hover:translate-x-1 transition-transform">
                      {todayChallenge.title}
                    </h4>
                    <p className="text-gray-400 leading-relaxed">
                      {todayChallenge.description || 'Uma nova missão está pronta para você. Inicie agora e garanta sua evolução diária no Éden.'}
                    </p>
                    <button 
                      onClick={() => !isCompleted && setIsMissionModalOpen(true)}
                      disabled={isCompleted}
                      className={`inline-flex items-center gap-3 px-8 py-4 font-black uppercase tracking-widest text-xs rounded-none transition-all shadow-[0_10px_20px_rgba(75,211,255,0.2)] ${isCompleted ? 'bg-emerald-500/20 text-emerald-400 cursor-not-allowed shadow-none' : 'bg-[#4bd3ff] text-[#020507] hover:bg-[#38bdf8]'}`}
                    >
                      {isCompleted ? <CheckCircle size={18} /> : <Plus size={18} />}
                      {isCompleted ? 'Concluída' : 'Iniciar Missão'}
                    </button>
                  </div>
                  <div className="shrink-0 w-32 h-32 bg-[#0b2831]/20 border border-[#4bd3ff]/20 flex items-center justify-center rounded-none rotate-3 relative z-10">
                    <Calendar size={48} className="text-[#4bd3ff]" />
                  </div>
                </div>
              )})() : (
                <div className="bg-white/5 border border-white/5 border-dashed p-12 text-center rounded-none">
                  <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Nenhuma missão liberada para hoje ainda.</p>
                </div>
              )}
            </section>
          </div>
        );
      }
      case 'guardiao':
        return (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <Shield size={64} className="text-[#0b2831] mb-6 opacity-80" />
            <h2 className="text-3xl font-bold text-white mb-4">O Guardião está despertando...</h2>
            <p className="text-gray-400 max-w-lg mb-8">
              A Inteligência Artificial do Éden está sendo calibrada. Em breve, você terá um mentor virtual exclusivo para guiar cada passo da sua jornada.
            </p>
            <div className="px-6 py-3 rounded-full bg-[#0b2831]/20 border border-[#0b2831]/50 text-[#4bd3ff] text-sm font-medium">
              Em Desenvolvimento
            </div>
          </div>
        );
      default:
        return null;
    }
  };

    const renderAdminMissions = () => {
    if (editingMission) {
      return (
        <div className="max-w-4xl space-y-8 pb-32">
          <div className="flex items-center gap-4">
            <button onClick={() => setEditingMission(null)} className="p-2 text-gray-400 hover:text-white rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
              <ChevronLeft size={24} />
            </button>
            <div>
              <h3 className="text-2xl font-black text-white uppercase tracking-tight">
                {editingMission.id ? 'Editar Missão' : 'Nova Missão'}
              </h3>
            </div>
          </div>
          
          <div className="space-y-6 bg-white/5 border border-white/10 p-6 rounded-2xl">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Data (DD-MM-YYYY)</label>
                <input 
                  type="text" 
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#4bd3ff]/50 transition-colors"
                  value={editingMission.date}
                  onChange={(e) => setEditingMission({ ...editingMission, date: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Título</label>
                <input 
                  type="text" 
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#4bd3ff]/50 transition-colors"
                  value={editingMission.title}
                  onChange={(e) => setEditingMission({ ...editingMission, title: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Descrição</label>
                <textarea 
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#4bd3ff]/50 transition-colors min-h-[100px]"
                  value={editingMission.description}
                  onChange={(e) => setEditingMission({ ...editingMission, description: e.target.value })}
                />
              </div>
            </div>

            <div className="pt-6 border-t border-white/10 space-y-4">
              <h4 className="text-lg font-bold text-white mb-4">Perguntas Formato (Forms)</h4>
              {editingMission.questions.map((q, qIndex) => (
                <div key={q.id} className="bg-black/30 border border-white/5 rounded-xl p-4 space-y-4 relative group">
                  <button 
                    onClick={() => {
                      const newQuestions = [...editingMission.questions];
                      newQuestions.splice(qIndex, 1);
                      setEditingMission({ ...editingMission, questions: newQuestions });
                    }}
                    className="absolute top-4 right-4 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={16} />
                  </button>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mr-8">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Tipo de Pergunta</label>
                        <select 
                          className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
                          value={q.type}
                          onChange={(e) => {
                            const newQuestions = [...editingMission.questions];
                            newQuestions[qIndex].type = e.target.value as any;
                            if (!newQuestions[qIndex].options && (e.target.value === 'radio' || e.target.value === 'checkbox')) {
                              newQuestions[qIndex].options = ['Opção 1'];
                            }
                            setEditingMission({ ...editingMission, questions: newQuestions });
                          }}
                        >
                          <option value="text">Texto Curto</option>
                          <option value="textarea">Texto Longo</option>
                          <option value="radio">Múltipla Escolha (Uma opção)</option>
                          <option value="checkbox">Caixas de Seleção (Várias)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Enunciado (Pergunta)</label>
                        <input 
                          type="text" 
                          className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
                          value={q.label}
                          onChange={(e) => {
                            const newQuestions = [...editingMission.questions];
                            newQuestions[qIndex].label = e.target.value;
                            setEditingMission({ ...editingMission, questions: newQuestions });
                          }}
                        />
                      </div>
                  </div>
                  
                  {(q.type === 'radio' || q.type === 'checkbox') && (
                    <div className="space-y-2 mt-4 pl-4 border-l-2 border-[#4bd3ff]/30">
                      <label className="block text-[10px] font-bold text-gray-500 uppercase">Opções de Resposta</label>
                      {q.options?.map((opt, optIndex) => (
                        <div key={optIndex} className="flex items-center gap-2">
                           <div className={`w-4 h-4 shrink-0 rounded-sm border border-white/20 ${q.type === 'radio' ? 'rounded-full' : ''}`} />
                           <input 
                             type="text" 
                             className="bg-transparent border-b border-white/10 px-2 py-1 text-sm text-white focus:outline-none focus:border-[#4bd3ff] w-full"
                             value={opt}
                             onChange={(e) => {
                               const newQuestions = [...editingMission.questions];
                               newQuestions[qIndex].options![optIndex] = e.target.value;
                               setEditingMission({ ...editingMission, questions: newQuestions });
                             }}
                           />
                           <button onClick={() => {
                               const newQuestions = [...editingMission.questions];
                               newQuestions[qIndex].options!.splice(optIndex, 1);
                               setEditingMission({ ...editingMission, questions: newQuestions });
                           }} className="text-gray-500 hover:text-red-400 p-1">
                             <X size={14} />
                           </button>
                        </div>
                      ))}
                      <button 
                        onClick={() => {
                           const newQuestions = [...editingMission.questions];
                           newQuestions[qIndex].options!.push(`Opção ${newQuestions[qIndex].options!.length + 1}`);
                           setEditingMission({ ...editingMission, questions: newQuestions });
                        }}
                        className="text-xs text-[#4bd3ff] font-bold hover:underline py-1 mt-2 flex items-center gap-1"
                      >
                         <Plus size={12} /> Adicionar Opção
                      </button>
                    </div>
                  )}
                </div>
              ))}
              
              <button 
                onClick={() => {
                  setEditingMission({
                    ...editingMission,
                    questions: [...editingMission.questions, { id: Math.random().toString(36).substring(2,9), label: 'Nova Pergunta', type: 'text' }]
                  });
                }}
                className="w-full py-4 border-2 border-dashed border-white/10 rounded-xl text-gray-500 font-black uppercase tracking-widest text-xs hover:border-[#4bd3ff]/50 hover:text-[#4bd3ff] transition-all flex items-center justify-center gap-2"
              >
                <Plus size={16} /> Adicionar Pergunta
              </button>
            </div>

            <button
               onClick={async () => {
                  try {
                    const normalizedDate = editingMission.date.trim();
                    if (!normalizedDate || !editingMission.title) {
                       alert('Data e título são obrigatórios.');
                       return;
                    }
                    if (editingMission.id) {
                      await setDoc(doc(db, 'dailyChallenges', normalizedDate), {
                         ...editingMission,
                         date: normalizedDate,
                         id: normalizedDate,
                      });
                      if (editingMission.id !== normalizedDate) {
                        await deleteDoc(doc(db, 'dailyChallenges', editingMission.id));
                      }
                    } else {
                      await setDoc(doc(db, 'dailyChallenges', normalizedDate), {
                         ...editingMission,
                         date: normalizedDate,
                         createdAt: serverTimestamp() // Add import for serverTimestamp if not already added. App.tsx already imports it!
                      });
                    }
                    setEditingMission(null);
                  } catch (e) {
                     handleFirestoreError(e, OperationType.WRITE, 'dailyChallenges');
                  }
               }}
               className="w-full bg-[#4bd3ff] hover:bg-[#38bdf8] text-black py-4 rounded-xl font-black uppercase tracking-[0.2em] text-xs transition-all mt-8"
            >
              Salvar Missão
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="max-w-4xl space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-black text-white uppercase tracking-tight">Missões Diárias</h3>
            <p className="text-gray-400 text-sm">Crie desafios específicos para cada data.</p>
          </div>
          <button 
            onClick={() => setEditingMission({
               date: new Date().toLocaleDateString('pt-BR').split('/').join('-'),
               title: '',
               description: '',
               questions: []
            })}
            className="bg-[#4bd3ff] text-black px-6 py-2.5 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-[#38bdf8] transition-all flex items-center"
          >
            <Plus size={18} className="inline mr-2" /> Nova Missão
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {dailyChallenges.map(mission => {
            const missionCompletions = allCompletions.filter(c => c.challengeDate === mission.date);
            const [d,m,y] = mission.date.split('-');
            const md = new Date(Number(y), Number(m)-1, Number(d));
            md.setHours(23,59,59,999);
            const isEnded = new Date() > md;

            return (
            <div key={mission.id} className="bg-white/5 border border-white/10 rounded-2xl p-6 relative">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Calendar size={18} className="text-[#4bd3ff]" />
                  <span className="text-white font-black uppercase tracking-widest text-xs">{mission.date}</span>
                  {isEnded && <span className="text-[10px] bg-red-500/20 text-red-500 px-2 py-0.5 rounded uppercase font-bold tracking-wider ml-2">Encerrada</span>}
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setEditingMission(mission)}
                    className="p-2 text-gray-400 hover:text-white"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    onClick={() => {
                      setPromptConfig({
                        title: 'Excluir Missão?',
                        description: 'Tem certeza que deseja excluir esta missão permanentemente?',
                        fields: [], 
                        submitText: 'Excluir',
                        onSubmit: async () => {
                          await deleteDoc(doc(db, 'dailyChallenges', mission.id!));
                        },
                        onCancel: () => setPromptConfig(null)
                      });
                    }}
                    className="p-2 text-gray-400 hover:text-red-400"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <h4 className="text-xl font-bold text-white mb-2">{mission.title}</h4>
              <p className="text-gray-400 text-sm mb-4">{mission.description || 'Sem descrição'}</p>
              
              <div className="mt-4 pt-4 border-t border-white/10">
                 <h5 className="text-sm font-bold text-gray-300 mb-4 flex items-center justify-between cursor-pointer hover:text-white" onClick={(e) => {
                     const el = e.currentTarget.nextElementSibling;
                     if (el) el.classList.toggle('hidden');
                     
                     const icon = e.currentTarget.querySelector('.chevron-icon');
                     if(icon) icon.classList.toggle('rotate-180');
                 }}>
                    <span>Respostas ({missionCompletions.length})</span> 
                    <ChevronDown size={16} className="chevron-icon transition-transform" />
                 </h5>
                 <div className="hidden space-y-4 max-h-64 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10">
                    {missionCompletions.length === 0 && <p className="text-xs text-gray-500">Nenhuma resposta ainda.</p>}
                    {missionCompletions.map(comp => {
                       const student = adminStudents.find(s => s.uid === comp.userId) || { name: 'Usuário Desconhecido' };
                       return (
                         <div key={comp.id} className="bg-black/30 p-4 rounded-lg border border-white/5 space-y-3">
                           <p className="text-sm font-black text-[#4bd3ff]">{student.name}</p>
                           {Object.entries(comp.responses || {}).map(([qId, ans]) => {
                             const qDef = mission.questions?.find(q => q.id === qId);
                             return (
                               <div key={qId} className="space-y-1">
                                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{qDef?.label || qId}</p>
                                  <p className="text-sm text-gray-300 bg-white/5 px-3 py-2 rounded">{Array.isArray(ans) ? ans.join(', ') : String(ans)}</p>
                               </div>
                             );
                           })}
                         </div>
                       )
                    })}
                 </div>
              </div>
            </div>
          )})}
        </div>
      </div>
    );
  };


    const renderAdminAudios = () => {
    if (editingAudio) {
      return (
        <div className="max-w-4xl space-y-8 pb-32">
          <div className="flex items-center gap-4">
            <button onClick={() => setEditingAudio(null)} className="p-2 text-gray-400 hover:text-white rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
              <ChevronLeft size={24} />
            </button>
            <div>
              <h3 className="text-2xl font-black text-white uppercase tracking-tight">
                {editingAudio.id ? 'Editar Áudio' : 'Novo Áudio'}
              </h3>
            </div>
          </div>
          
          <div className="space-y-6 bg-white/5 border border-white/10 p-6 rounded-2xl">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Data (DD-MM-YYYY)</label>
                <input 
                  type="text" 
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#4bd3ff]/50 transition-colors"
                  value={editingAudio.date}
                  onChange={(e) => setEditingAudio({ ...editingAudio, date: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Título</label>
                <input 
                  type="text" 
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#4bd3ff]/50 transition-colors"
                  value={editingAudio.title}
                  onChange={(e) => setEditingAudio({ ...editingAudio, title: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Subtítulo</label>
                <input 
                   type="text"
                   className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#4bd3ff]/50 transition-colors"
                   value={editingAudio.subtitle}
                   onChange={(e) => setEditingAudio({ ...editingAudio, subtitle: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">URL do Áudio (MP3/WAV)</label>
                <input 
                  type="text" 
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#4bd3ff]/50 transition-colors"
                  value={editingAudio.audioUrl}
                  onChange={(e) => setEditingAudio({ ...editingAudio, audioUrl: e.target.value })}
                />
              </div>
            </div>

            <button
               onClick={async () => {
                  try {
                    const normalizedDate = editingAudio.date.trim();
                    if (!normalizedDate || !editingAudio.title || !editingAudio.audioUrl) {
                       alert('Data, título e URL do áudio são obrigatórios.');
                       return;
                    }
                    if (editingAudio.id) {
                      await setDoc(doc(db, 'dailyAudios', normalizedDate), {
                         ...editingAudio,
                         date: normalizedDate,
                         id: normalizedDate,
                      });
                      if (editingAudio.id !== normalizedDate) {
                        await deleteDoc(doc(db, 'dailyAudios', editingAudio.id));
                      }
                    } else {
                      await setDoc(doc(db, 'dailyAudios', normalizedDate), {
                         ...editingAudio,
                         date: normalizedDate,
                         createdAt: serverTimestamp()
                      });
                    }
                    setEditingAudio(null);
                  } catch (e) {
                     handleFirestoreError(e, 'WRITE', 'dailyAudios');
                  }
               }}
               className="w-full bg-[#4bd3ff] hover:bg-[#38bdf8] text-black py-4 rounded-xl font-black uppercase tracking-[0.2em] text-xs transition-all mt-8"
            >
              Salvar Áudio do Dia
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="max-w-4xl space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-black text-white uppercase tracking-tight">Áudios do Guardião</h3>
            <p className="text-gray-400 text-sm">Programe os áudios diários por data.</p>
          </div>
          <button 
            onClick={() => setEditingAudio({
               date: new Date().toLocaleDateString('pt-BR').split('/').join('-'),
               title: '',
               subtitle: 'Mensagem Diária • O Despertar',
               audioUrl: ''
            })}
            className="bg-[#4bd3ff] text-black px-6 py-2.5 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-[#38bdf8] transition-all flex items-center"
          >
            <Plus size={18} className="inline mr-2" /> Novo Áudio
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {allAudios.map(audio => {
            const [d,m,y] = audio.date.split('-');
            const md = new Date(Number(y), Number(m)-1, Number(d));
            md.setHours(23,59,59,999);
            const isEnded = new Date() > md;

            return (
            <div key={audio.id} className="bg-white/5 border border-white/10 rounded-2xl p-6 relative">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Calendar size={18} className="text-[#4bd3ff]" />
                  <span className="text-white font-black uppercase tracking-widest text-xs">{audio.date}</span>
                  {isEnded && <span className="text-[10px] bg-red-500/20 text-red-500 px-2 py-0.5 rounded uppercase font-bold tracking-wider ml-2">Passado</span>}
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setEditingAudio(audio)}
                    className="p-2 text-gray-400 hover:text-white"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    onClick={() => {
                      setPromptConfig({
                        title: 'Excluir Áudio?',
                        description: 'Tem certeza que deseja excluir este áudio permanentemente?',
                        fields: [], 
                        submitText: 'Excluir',
                        onSubmit: async () => {
                          await deleteDoc(doc(db, 'dailyAudios', audio.id!));
                        },
                        onCancel: () => setPromptConfig(null)
                      });
                    }}
                    className="p-2 text-gray-400 hover:text-red-400"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <h4 className="text-xl font-bold text-white mb-2">{audio.title}</h4>
              <p className="text-[#4bd3ff] text-xs font-bold uppercase tracking-widest mb-4">{audio.subtitle}</p>
              <p className="text-gray-400 text-xs truncate max-w-sm">{audio.audioUrl}</p>
            </div>
          )})}
        </div>
      </div>
    );
  };

  const handleSaveLevels = async () => {
    try {
      await setDoc(doc(db, 'settings', 'levels'), { levels: userLevels });
      alert('Níveis salvos com sucesso!');
    } catch (e) {
      handleFirestoreError(e, 'WRITE' as any, 'settings/levels');
    }
  };

  const renderAdminLevels = () => (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-2xl font-black text-white uppercase tracking-tight">Níveis de Acesso</h3>
          <p className="text-gray-400 text-sm mt-1">Defina os Níveis de progresso do Éden baseado em pontos.</p>
        </div>
        <button 
          onClick={handleSaveLevels}
          className="flex items-center gap-2 bg-[#4bd3ff] text-[#020507] hover:bg-[#38bdf8] px-6 py-2.5 rounded-xl font-bold uppercase tracking-widest text-xs transition-colors"
        >
          <CheckCircle size={16} /> Salvar Alterações
        </button>
      </div>
      
      <div className="space-y-4">
        {userLevels.map((lvl, index) => (
          <div key={lvl.id || index} className="flex gap-4 p-4 border border-white/5 bg-white/5 rounded-xl items-center">
            <div className="flex-1 space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Nome do Nível</label>
              <input 
                value={lvl.title} 
                onChange={(e) => {
                  const newLevels = [...userLevels];
                  newLevels[index].title = e.target.value;
                  setUserLevels(newLevels);
                }}
                className="w-full bg-black/40 border border-white/10 p-3 rounded-lg text-white font-bold"
              />
            </div>
            <div className="flex-1 space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Pontos (Mínimo)</label>
              <input 
                type="number"
                value={lvl.points} 
                onChange={(e) => {
                  const newLevels = [...userLevels];
                  newLevels[index].points = Number(e.target.value) || 0;
                  setUserLevels(newLevels);
                }}
                className="w-full bg-black/40 border border-white/10 p-3 rounded-lg text-white"
              />
            </div>
            <div className="w-32 space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Ícone</label>
              <select 
                value={lvl.iconName}
                onChange={(e) => {
                  const newLevels = [...userLevels];
                  newLevels[index].iconName = e.target.value;
                  setUserLevels(newLevels);
                }}
                className="w-full bg-black/40 border border-white/10 p-3 rounded-lg text-white"
              >
                {Object.keys(ICON_MAP).map(key => (
                  <option key={key} value={key}>{key}</option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderAdminPanel = () => (
	    <div className="fixed inset-0 z-[200] bg-[#020507] flex flex-col animate-in fade-in duration-300">
      {/* Admin Top Bar */}
	      <div className="min-h-16 shrink-0 border-b border-white/10 bg-black/40 backdrop-blur-md flex items-center justify-between gap-3 px-4 sm:px-6 py-3 pt-safe">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-[#0b2831] flex items-center justify-center">
            <Shield size={18} className="text-emerald-400" />
          </div>
	          <h2 className="text-sm sm:text-lg font-black text-white uppercase tracking-tighter leading-tight">Painel de Controle Éden</h2>
        </div>
        <button 
          onClick={() => setIsAdminPanelOpen(false)}
          className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white"
        >
          <X size={24} />
        </button>
      </div>

	      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Sidebar */}
	        <div className="md:w-64 shrink-0 bg-black/20 border-b md:border-b-0 md:border-r border-white/10 flex md:flex-col overflow-x-auto md:overflow-visible py-3 md:py-4 scrollbar-hide">
	          <div className="flex md:block gap-2 md:space-y-1 px-3 min-w-max md:min-w-0">
              {[
                {id: 'geral', label: 'Geral', icon: LayoutDashboard},
                {id: 'trilhas', label: 'Trilhas', icon: Compass},
                {id: 'modulos', label: 'Módulos', icon: Video},
                {id: 'missoes', label: 'Missão do Dia', icon: Calendar},
                {id: 'alunos', label: 'Alunos', icon: Users},
                {id: 'materiais', label: 'Materiais', icon: FileText},
                {id: 'audio', label: 'Áudio do Dia', icon: Mic},
                {id: 'niveis', label: 'Níveis (Progresso)', icon: Crown},
              ].map(item => (
              <button
                key={item.id}
                onClick={() => setAdminActiveSection(item.id)}
	                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all whitespace-nowrap ${
                  adminActiveSection === item.id 
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                    : 'text-gray-400 hover:text-gray-200 hover:bg-white/5 border border-transparent'
                }`}
              >
                <item.icon size={20} />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content View */}
	        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 custom-scrollbar">
          {adminActiveSection === 'geral' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <h3 className="text-3xl font-black text-white tracking-tight leading-tight">Dashboard Administrativo</h3>
                  <p className="text-gray-400 font-medium">Visão geral da plataforma Éden</p>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { label: 'Total de Módulos', value: trailsState.reduce((acc, t) => acc + (t.modules?.length || 0), 0), icon: Video, color: 'bg-blue-500/10 text-blue-400' },
                  { label: 'Total de Alunos', value: adminStudents.length, icon: Users, color: 'bg-emerald-500/10 text-emerald-400' },
                  { label: 'Atividade no Éden', value: '2', icon: Mic, color: 'bg-purple-500/10 text-purple-400' },
                  { label: 'Folhas Distribuídas', value: adminStudents.reduce((acc, s) => acc + (s.points || 0), 0), icon: FileText, color: 'bg-emerald-500/10 text-emerald-400' },
                ].map((stat, i) => (
                  <div key={i} className="bg-white/5 border border-white/10 p-6 rounded-2xl flex flex-col justify-between min-h-[140px] hover:border-white/20 transition-all hover:-translate-y-1">
                    <div className="flex items-start justify-between">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{stat.label}</p>
                      <div className={`p-2.5 rounded-xl ${stat.color}`}>
                        <stat.icon size={20} />
                      </div>
                    </div>
                    <p className="text-4xl font-black text-white mt-4">{stat.value}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Visual Settings / Visibility */}
                <div className="bg-white/5 border border-white/10 rounded-3xl p-8">
                  <h4 className="text-xl font-black text-white uppercase tracking-tight mb-6 flex items-center gap-2">
                    <List size={22} className="text-emerald-400" />
                    Ações Rápidas
                  </h4>
                  <div className="space-y-3">
                    {[
                      { label: 'Gerenciar Módulos', icon: Video, action: () => setAdminActiveSection('modulos') },
                      { label: 'Gerenciar Usuários', icon: Users, action: () => setAdminActiveSection('alunos') },
                      { label: 'Vincular Materiais', icon: FileText, action: () => setAdminActiveSection('materiais') },
                    ].map((item, i) => (
                      <button 
                        key={i}
                        onClick={item.action}
                        className="w-full flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors group"
                      >
                        <div className="flex items-center gap-3">
                          <item.icon size={18} className="text-gray-400 group-hover:text-white" />
                          <span className="text-white font-bold">{item.label}</span>
                        </div>
                        <ChevronRight size={18} className="text-gray-600 group-hover:text-white" />
                      </button>
                    ))}
                  </div>
                </div>

                {/* System Info */}
                <div className="bg-white/5 border border-white/10 rounded-3xl p-8">
                  <h4 className="text-xl font-black text-white uppercase tracking-tight mb-6 flex items-center gap-2">
                    <Settings size={22} className="text-[#4bd3ff]" />
                    Informações do Sistema
                  </h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between py-2 border-b border-white/5">
                      <span className="text-gray-400 font-medium">Status</span>
                      <span className="flex items-center gap-2 text-emerald-400 font-bold">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                        Online
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-white/5">
                      <span className="text-gray-400 font-medium">Versão</span>
                      <span className="text-white font-mono text-sm">1.0.0</span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-gray-400 font-medium">Plataforma</span>
                      <span className="text-white font-bold">Éden</span>
                    </div>
                    <div className="pt-4">
                      <button 
                        onClick={() => setAdminActiveSection('perfil')}
                        className="w-full text-center text-xs font-bold text-gray-500 uppercase tracking-widest hover:text-white transition-colors"
                      >
                        Ver Logs de Acesso
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Visibility Controls */}
              <section className="bg-white/5 border border-white/10 rounded-3xl p-8">
                <h3 className="text-xl font-black text-white uppercase tracking-tight mb-6 flex items-center gap-2">
                   <Settings size={22} className="text-emerald-400" />
                   Visibilidade das Funções
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  {INITIAL_TABS.map(tab => {
                    if (tab.id === 'jornada') return null;
                    const isVisible = tabVisibility[tab.id as keyof typeof tabVisibility];
                    return (
                      <div key={tab.id} className="flex flex-col gap-4 p-5 bg-black/20 border border-white/5 rounded-2xl group hover:border-[#4bd3ff]/30 transition-all">
                        <div className="flex items-center justify-between">
                          <div className={`p-2.5 rounded-xl ${isVisible ? 'bg-emerald-500/10 text-emerald-400' : 'bg-gray-800 text-gray-500'}`}>
                            <tab.icon size={20} />
                          </div>
                          <button 
                            onClick={() => setTabVisibility(prev => ({ ...prev, [tab.id]: !prev[tab.id as keyof typeof prev] }))}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${isVisible ? 'bg-emerald-500' : 'bg-gray-700'}`}
                          >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isVisible ? 'translate-x-6' : 'translate-x-1'}`} />
                          </button>
                        </div>
                        <p className="text-white font-bold text-sm tracking-tight">{tab.label}</p>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          )}

          {adminActiveSection === 'modulos' && (
            <div className="max-w-4xl space-y-6">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-2xl font-black text-white uppercase tracking-tight">Conteúdos</h3>
                  <p className="text-gray-400 text-sm mt-1">Gerencie os conteúdos das aulas dentro dos módulos de suas trilhas.</p>
                </div>
                <div className="text-sm text-gray-500 font-medium bg-white/5 border border-white/10 px-4 py-2 rounded-xl">
                  Dica: Para criar um novo módulo, use a aba "Trilhas".
                </div>
              </div>

              <div className="space-y-4">
                {trailsState.flatMap(t => (t.modules || []).map(m => ({ ...m, trailId: t.id, trailTitle: t.title }))).map(module => (
                  <div key={`${module.trailId}-${module.id}`} className="bg-[#0b0c10]/40 border border-white/10 rounded-2xl overflow-hidden">
                    <div className="p-6 flex items-center justify-between group">
                      <div className="flex items-center gap-6">
                        <div className="cursor-grab active:cursor-grabbing text-gray-600 hover:text-gray-400">
                          <div className="grid grid-cols-2 gap-1">
                            <div className="w-1 h-1 rounded-full bg-current"></div>
                            <div className="w-1 h-1 rounded-full bg-current"></div>
                            <div className="w-1 h-1 rounded-full bg-current"></div>
                            <div className="w-1 h-1 rounded-full bg-current"></div>
                            <div className="w-1 h-1 rounded-full bg-current"></div>
                            <div className="w-1 h-1 rounded-full bg-current"></div>
                          </div>
                        </div>
                        
                        <div className="w-16 h-24 rounded-lg bg-gray-800 border border-white/5 overflow-hidden relative">
                          <img src={module.imageUrl} className="w-full h-full object-cover opacity-60" alt="" />
                          <div className="absolute top-0 inset-x-0 bg-gradient-to-b from-black/80 to-transparent p-1">
                            <p className="text-[8px] font-black uppercase text-emerald-400 text-center tracking-widest truncate">{module.trailTitle}</p>
                          </div>
                        </div>
                        
                        <div>
                          <h4 className="text-xl font-extrabold text-white mb-1">{module.title}</h4>
                          <div className="flex items-center gap-2 text-gray-500 text-sm">
                            <List size={14} />
                            <span>{module.items?.length || 0}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <button 
                           onClick={() => {
                             setPromptConfig({
                               title: 'Adicionar Conteúdo',
                               description: 'Nova aula ou material para o módulo.',
                               fields: [
                                 { name: 'title', label: 'Título do conteúdo', required: true },
                                 { name: 'videoUrl', label: 'URL do Vídeo (Youtube/Vimeo)' },
                                 { name: 'imageUrl', label: 'URL da capa da aula (opcional)' }
                               ],
                               onSubmit: async (data) => {
                                 try {
                                   const updatedItems = [...(module.items || []), {
                                     id: Math.random().toString(36).substr(2, 9),
                                     title: data.title,
                                     type: 'video',
                                     videoUrl: data.videoUrl,
                                     imageUrl: data.imageUrl || getVideoThumbnail(data.videoUrl) || 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&q=80&w=800',
                                     description: 'Nova aula adicionada'
                                   }];

                                   const trail = trailsState.find(t => t.id === module.trailId);
                                   if (!trail) return;

                                   const updatedModules = (trail.modules || []).map(m => m.id === module.id ? { ...m, items: updatedItems } : m);
                                   await updateDoc(doc(db, 'trails', trail.id), { modules: updatedModules });
                                 } catch (e) { 
                                   console.error('Erro ao adicionar conteúdo:', e);
                                   handleFirestoreError(e, OperationType.UPDATE, `trails/${module.trailId}`); 
                                 }
                               },
                               onCancel: () => setPromptConfig(null)
                             });
                           }}
                           className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2"
                        >
                           <Plus size={18} /> Adicionar conteúdo
                        </button>
                        <button 
                          onClick={() => {
                            setPromptConfig({
                              title: 'Editar Módulo',
                              fields: [
                                { name: 'title', label: 'Nome do módulo', defaultValue: module.title, required: true },
                                { name: 'imageUrl', label: 'URL da imagem de capa (opcional)', defaultValue: module.imageUrl || '' }
                              ],
                              onSubmit: async (data) => {
                                try {
                                  const trail = trailsState.find(t => t.id === module.trailId);
                                  if (!trail) return;

                                  const updatedModules = (trail.modules || []).map(m => 
                                    m.id === module.id 
                                      ? { ...m, title: data.title, imageUrl: data.imageUrl || m.imageUrl } 
                                      : m
                                  );
                                  await updateDoc(doc(db, 'trails', trail.id), { modules: updatedModules });
                                } catch (e) {
                                  handleFirestoreError(e, OperationType.UPDATE, `trails/${module.trailId}`);
                                }
                              },
                              onCancel: () => setPromptConfig(null)
                            });
                          }}
                          className="p-2 text-gray-500 hover:text-white transition-colors"
                        >
                          <Settings size={20} />
                        </button>
                      </div>
                    </div>

                    {/* Lesson List */}
                    <div className="border-t border-white/5 bg-black/20">
                      {module.items?.map((lesson: any) => (
                        <div key={lesson.id} className="flex items-center justify-between p-4 pl-16 border-b border-white/5 last:border-0 hover:bg-white/5 group/lesson">
                          <div className="flex items-center gap-4">
                            <div className="w-20 h-12 rounded bg-gray-700 overflow-hidden border border-white/5">
                              {lesson.imageUrl ? (
                                <img src={lesson.imageUrl} className="w-full h-full object-cover" alt="" />
                              ) : (
                                <Video size={16} className="text-gray-600 mx-auto mt-4" />
                              )}
                            </div>
                            <div>
                               <p className="text-white font-bold">{lesson.title}</p>
                               <p className="text-[10px] uppercase tracking-widest text-gray-500 font-black">{lesson.type}</p>
                            </div>
                          </div>
                          <button 
                            onClick={() => {
                              setPromptConfig({
                                title: 'Editar Aula',
                                fields: [
                                  { name: 'title', label: 'Título da aula', defaultValue: lesson.title, required: true },
                                  { name: 'videoUrl', label: 'URL do Vídeo (Vimeo/Youtube)', defaultValue: lesson.videoUrl || '' },
                                  { name: 'imageUrl', label: 'URL da capa (Thumb do vídeo/Imagem)', defaultValue: lesson.imageUrl || '' }
                                ],
                                onSubmit: async (data) => {
                                  try {
                                    const trail = trailsState.find(t => t.id === module.trailId);
                                    if (!trail) return;

                                    const updatedItems = (module.items || []).map((i: any) => 
                                      i.id === lesson.id 
                                        ? { ...i, title: data.title, videoUrl: data.videoUrl, imageUrl: data.imageUrl || getVideoThumbnail(data.videoUrl) || i.imageUrl } 
                                        : i
                                    );
                                    
                                    const updatedModules = (trail.modules || []).map((m: any) => 
                                      m.id === module.id ? { ...m, items: updatedItems } : m
                                    );

                                    await updateDoc(doc(db, 'trails', trail.id), { modules: updatedModules });
                                  } catch (e) {
                                    handleFirestoreError(e, OperationType.UPDATE, `trails/${module.trailId}`);
                                  }
                                },
                                onCancel: () => setPromptConfig(null)
                              });
                            }}
                            className="p-2 text-gray-600 hover:text-white"
                          >
                            <Settings size={18} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {adminActiveSection === 'trilhas' && (
            <div className="max-w-4xl space-y-6">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-2xl font-black text-white uppercase tracking-tight">Trilhas</h3>
                  <p className="text-gray-400 text-sm mt-1">Organize seus módulos em trilhas de aprendizado para os alunos.</p>
                </div>
                <button 
                  onClick={() => {
                    setPromptConfig({
                      title: 'Nova Trilha',
                      fields: [{ name: 'title', label: 'Nome da trilha', required: true }],
                      onSubmit: async (data) => {
                        try {
                          await addDoc(collection(db, 'trails'), {
                            title: data.title,
                            modules: [],
                            order: trailsState.length,
                            createdAt: serverTimestamp()
                          });
                        } catch (e) {
                          handleFirestoreError(e, OperationType.CREATE, 'trails');
                        }
                      },
                      onCancel: () => setPromptConfig(null)
                    });
                  }}
                  className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black px-6 py-2.5 rounded-xl font-black transition-all"
                >
                  <Plus size={20} /> Nova Trilha
                </button>
              </div>

              <div className="space-y-4">
                {trailsState.map((trail, index) => (
                  <div key={trail.id} className="bg-white/5 border border-white/10 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-6">
                       <h4 className="text-xl font-bold text-white flex items-center gap-3">
                         <div className="flex flex-col gap-0.5">
                           <button 
                             disabled={index === 0}
                             className={`p-1 rounded hover:bg-white/10 transition-colors ${index === 0 ? 'opacity-30 cursor-not-allowed' : 'text-gray-400 hover:text-white'}`}
                             onClick={async () => {
                               try {
                                 const prevTrail = trailsState[index - 1];
                                 if (!prevTrail) return;
                                 const currentOrder = trail.order || index;
                                 const prevOrder = prevTrail.order || (index - 1);
                                 await updateDoc(doc(db, 'trails', trail.id), { order: prevOrder });
                                 await updateDoc(doc(db, 'trails', prevTrail.id), { order: currentOrder });
                               } catch (e) {
                                 handleFirestoreError(e, OperationType.UPDATE, `trails/${trail.id}`);
                               }
                             }}
                           >
                             <ArrowUp size={14} />
                           </button>
                           <button 
                             disabled={index === trailsState.length - 1}
                             className={`p-1 rounded hover:bg-white/10 transition-colors ${index === trailsState.length - 1 ? 'opacity-30 cursor-not-allowed' : 'text-gray-400 hover:text-white'}`}
                             onClick={async () => {
                               try {
                                 const nextTrail = trailsState[index + 1];
                                 if (!nextTrail) return;
                                 const currentOrder = trail.order || index;
                                 const nextOrder = nextTrail.order || (index + 1);
                                 await updateDoc(doc(db, 'trails', trail.id), { order: nextOrder });
                                 await updateDoc(doc(db, 'trails', nextTrail.id), { order: currentOrder });
                               } catch (e) {
                                 handleFirestoreError(e, OperationType.UPDATE, `trails/${trail.id}`);
                               }
                             }}
                           >
                             <ArrowDown size={14} />
                           </button>
                         </div>
                         {trail.title}
                       </h4>
                       <div className="flex gap-2">
                         <button 
                           onClick={() => {
                             setPromptConfig({
                               title: 'Editar Trilha',
                               fields: [{ name: 'title', label: 'Nome da trilha', defaultValue: trail.title, required: true }],
                               onSubmit: async (data) => {
                                 await updateDoc(doc(db, 'trails', trail.id), { title: data.title });
                               },
                               onCancel: () => setPromptConfig(null)
                             });
                           }}
                           className="p-2 text-gray-400 hover:text-white"
                         >
                           <Edit2 size={18} />
                         </button>
                         <button 
                           onClick={() => {
                             setPromptConfig({
                               title: 'Excluir Trilha?',
                               description: 'Todos os módulos dentro desta trilha também serão removidos. Deseja continuar?',
                               submitText: 'Excluir',
                               fields: [],
                               onSubmit: async () => {
                                 await deleteDoc(doc(db, 'trails', trail.id));
                               },
                               onCancel: () => setPromptConfig(null)
                             });
                           }}
                           className="p-2 text-gray-400 hover:text-red-400"
                         >
                           <Trash2 size={18} />
                         </button>
                       </div>
                    </div>
                    
                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                      {trail.modules?.map(mod => (
                        <div key={mod.id} className="w-32 shrink-0 bg-black/40 rounded-xl p-2 border border-white/5">
                           <img src={mod.imageUrl} className="w-full h-32 object-cover rounded-lg mb-2 opacity-60" alt="" />
                           <p className="text-[10px] font-black text-white truncate text-center uppercase tracking-tighter">{mod.title}</p>
                        </div>
                      ))}
                      <button 
                        onClick={() => {
                          const isLegacyMock = trail.id === 'trail-1' && !trailsState.some(t => t.id !== 'trail-1');
                          setPromptConfig({
                            title: 'Novo Módulo',
                            description: 'Este módulo será adicionado à trilha atual.',
                            fields: [
                              { name: 'title', label: 'Nome do módulo', required: true },
                              { name: 'imageUrl', label: 'URL da capa do módulo (opcional)' }
                            ],
                            onSubmit: async (data) => {
                              try {
                                const newModule = {
                                  id: Math.random().toString(36).substr(2, 9),
                                  title: data.title,
                                  imageUrl: data.imageUrl || 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=80&w=600&h=900',
                                  items: []
                                };
                                
                                if (isLegacyMock) {
                                  await addDoc(collection(db, 'trails'), {
                                    title: 'Minha Trilha de Conteúdo',
                                    modules: [newModule],
                                    order: trailsState.length,
                                    createdAt: serverTimestamp()
                                  });
                                } else {
                                  const updatedModules = [...(trail.modules || []), newModule];
                                  await updateDoc(doc(db, 'trails', trail.id), { modules: updatedModules });
                                }
                              } catch (e) {
                                handleFirestoreError(e, OperationType.UPDATE, `trails/${trail.id}`);
                              }
                            },
                            onCancel: () => setPromptConfig(null)
                          });
                        }}
                        className="w-32 shrink-0 h-40 border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center gap-2 text-gray-500 hover:text-emerald-400 hover:border-emerald-400/50"
                      >
                        <Plus size={24} />
                        <span className="text-[10px] font-bold uppercase">Add Módulo</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

	          {adminActiveSection === 'alunos' && (
	            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
	              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
	                <div>
	                  <h3 className="text-3xl font-black text-white tracking-tight">Gerenciar Usuários</h3>
	                  <p className="text-gray-400 font-medium tracking-tight">Gerencie alunos, roles e permissões</p>
	                </div>
	                <button
	                  onClick={() => {
	                    setPromptConfig({
	                      title: 'Adicionar Aluno',
	                      description: 'O aluno receberá um link de primeiro acesso por email. A conta no Auth será criada quando ele abrir o link.',
	                      submitText: 'Criar Aluno',
	                      fields: [
	                        { name: 'name', label: 'Nome do aluno', required: true },
	                        { name: 'email', label: 'Email de acesso', type: 'email', required: true }
	                      ],
	                      onSubmit: handleCreateStudent,
	                      onCancel: () => setPromptConfig(null)
	                    });
	                  }}
	                  className="flex items-center justify-center gap-2 bg-[#4bd3ff] hover:bg-[#38bdf8] text-[#020507] px-6 py-3 rounded-xl font-black uppercase tracking-widest text-xs transition-all"
	                >
	                  <Plus size={18} /> Adicionar Aluno
	                </button>
	              </div>

              <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden mt-8 shadow-2xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-white/10 text-gray-500 text-[10px] font-black uppercase tracking-[0.2em]">
                        <th className="px-8 py-6">Nome</th>
                        <th className="px-6 py-6">Email</th>
                        <th className="px-6 py-6 text-center">Role</th>
                        <th className="px-6 py-6 text-center">Folhas</th>
                        <th className="px-6 py-6">Nível</th>
                        <th className="px-8 py-6 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {adminStudents.map((student) => (
                        <tr key={student.uid} className="hover:bg-white/5 transition-colors group">
                          <td className="px-8 py-5">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-blue-500/20 border border-white/5 flex items-center justify-center text-blue-400 font-bold text-xs shadow-inner">
                                {student.avatar ? <img src={student.avatar} className="w-full h-full rounded-full object-cover" /> : student.name ? student.name[0] : 'U'}
                              </div>
                              <span className="text-white font-extrabold tracking-tight">{student.name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-5 text-gray-400 font-medium text-sm tracking-tight">{student.email}</td>
                          <td className="px-6 py-5 text-center">
                            <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${student.role === 'admin' ? 'bg-[#4bd3ff] text-[#020507] shadow-lg' : 'bg-white/5 text-gray-400 border border-white/10'}`}>
                              {student.role === 'admin' ? 'Admin' : 'Aluno'}
                            </span>
                          </td>
                          <td className="px-6 py-5 text-center">
                            <div className="flex items-center justify-center gap-1.5 text-emerald-400 font-black">
                              <FileText size={14} className="fill-emerald-400" />
                              {student.points || 0}
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <span className="text-gray-400 text-sm font-medium tracking-tight">
                              {student.points && student.points >= 150 ? 'Transformador' : 'Renascido'}
                            </span>
                          </td>
                          <td className="px-8 py-5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button 
                                onClick={async () => {
                                  try {
                                    await updateDoc(doc(db, 'users', student.uid), {
                                      isCofounder: !student.isCofounder
                                    });
                                  } catch(e) {
                                    handleFirestoreError(e, OperationType.UPDATE, `users/${student.uid}`);
                                  }
                                }}
                                className={`p-2.5 bg-black/40 border border-white/5 rounded-lg transition-all ${student.isCofounder ? 'text-[#4bd3ff] hover:text-[#38bdf8]' : 'text-gray-400 hover:text-[#4bd3ff]'}`}
                                title={student.isCofounder ? "Remover status de Co-fundadora" : "Tornar Co-fundadora"}
                              >
                                <Key size={16} />
                              </button>
                              <button 
                                onClick={() => {
                                  setSelectedUser(student);
                                  setIsRoleModalOpen(true);
                                }}
                                className="p-2.5 bg-black/40 border border-white/5 rounded-lg text-gray-400 hover:text-white hover:border-[#4bd3ff]/50 transition-all group/btn"
                                title="Gerenciar Role"
                              >
                                <Settings size={18} className="group-hover/btn:rotate-90 transition-transform duration-500" />
                              </button>
                              
                              <button 
                                onClick={() => {
                                  setSelectedUser(student);
                                  setIsFolhasModalOpen(true);
                                  setLeavesAmount(0);
                                }}
                                className="px-4 py-2 bg-[#4bd3ff] rounded-lg text-[#020507] font-black text-[10px] uppercase tracking-widest hover:bg-[#3bc2ee] transition-colors shadow-lg"
                              >
                                Folhas
                              </button>

                              <button 
                                onClick={() => student.email && handleSendAccessLink(student.email)}
                                className="p-2.5 bg-black/40 border border-white/5 rounded-lg text-emerald-400/80 hover:bg-emerald-500 hover:text-white transition-all"
                                title="Enviar link de acesso"
                              >
                                <Lock size={18} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {adminActiveSection === 'materiais' && (
            <div className="max-w-4xl space-y-6">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-2xl font-black text-white uppercase tracking-tight">Arquivos Disponíveis</h3>
                  <p className="text-gray-400 text-sm mt-1">Materiais em PDF, E-books e Planners para download.</p>
                </div>
                <button 
                  onClick={() => {
                    setPromptConfig({
                      title: 'Novo Material',
                      fields: [
                        { name: 'title', label: 'Nome do Material', required: true },
                        { name: 'description', label: 'Descrição Curta' },
                        { name: 'imageUrl', label: 'URL da Imagem de Capa' },
                        { name: 'videoUrl', label: 'URL do Arquivo PDF/Doc' }
                      ],
                      onSubmit: async (data) => {
                        try {
                          await addDoc(collection(db, 'materials'), {
                            title: data.title,
                            description: data.description || '',
                            imageUrl: data.imageUrl || 'https://images.unsplash.com/photo-1544928147-79a2dbc1f389?auto=format&fit=crop&q=80',
                            videoUrl: data.videoUrl || '',
                            type: 'PDF',
                            duration: 'Documento'
                          });
                        } catch (e) {
                          handleFirestoreError(e, OperationType.CREATE, 'materials');
                        }
                      },
                      onCancel: () => setPromptConfig(null)
                    });
                  }}
                  className="flex items-center gap-2 bg-[#4bd3ff] hover:bg-[#0ea5e9] text-black px-6 py-2.5 rounded-xl font-black transition-all"
                >
                  <Plus size={20} /> SUBIR ARQUIVO
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {materiaisState[0].items.map(item => (
                  <div key={item.id} className="flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all">
                    <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-white/10">
                      <img src={item.imageUrl} className="w-full h-full object-cover" alt="" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold truncate">{item.title}</p>
                      <p className="text-gray-400 text-xs truncate">{item.description}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button className="p-2 text-gray-400 hover:text-[#4bd3ff]"><Edit2 size={18} /></button>
                      <button className="p-2 text-gray-400 hover:text-red-400"><Trash2 size={18} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {adminActiveSection === 'audio' && renderAdminAudios()}

          {adminActiveSection === 'missoes' && renderAdminMissions()}

          {adminActiveSection === 'niveis' && renderAdminLevels()}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#020507] text-white font-sans overflow-x-hidden">
      {loading && (
        <div className="fixed inset-0 z-[1000] bg-[#020507] flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
             <div className="w-16 h-16 border-4 border-[#4bd3ff]/20 border-t-[#4bd3ff] rounded-full animate-spin"></div>
             <p className="text-[#4bd3ff] font-black uppercase tracking-widest animate-pulse">Despertando o Éden...</p>
          </div>
        </div>
      )}
	      {!loading && !user && (
         <div className="fixed inset-0 z-[1000] bg-[#020507] flex items-center justify-center p-4">
           <div className="max-w-md w-full text-center space-y-7 animate-in fade-in zoom-in duration-500">
              <div className="w-24 h-24 bg-white/5 border border-white/10 rounded-3xl mx-auto flex items-center justify-center shadow-[0_0_30px_rgba(75,211,255,0.2)]">
                <Shield size={48} className="text-[#4bd3ff]" />
              </div>
              <div className="space-y-4">
                <h2 className="text-4xl font-black text-white tracking-tighter uppercase">Bem-Vindo ao Éden</h2>
                <p className="text-gray-400 font-medium">Acesse sua jornada de renascimento e conecte-se com sua essência.</p>
              </div>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (isSignInWithEmailLink(auth, window.location.href) && !window.localStorage.getItem(EMAIL_FOR_SIGN_IN_KEY)) {
                    completeEmailLinkSignIn(emailLinkConfirmationEmail);
                  } else {
                    handleLogin();
                  }
                }}
                className="space-y-4 text-left"
              >
                <div className="space-y-2">
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">Email</label>
                  <input
                    type="email"
                    value={isSignInWithEmailLink(auth, window.location.href) && !window.localStorage.getItem(EMAIL_FOR_SIGN_IN_KEY) ? emailLinkConfirmationEmail : loginEmail}
                    onChange={(event) => {
                      if (isSignInWithEmailLink(auth, window.location.href) && !window.localStorage.getItem(EMAIL_FOR_SIGN_IN_KEY)) {
                        setEmailLinkConfirmationEmail(event.target.value);
                      } else {
                        setLoginEmail(event.target.value);
                      }
                    }}
                    autoComplete="email"
                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-4 text-white focus:outline-none focus:border-[#4bd3ff] transition-colors"
                    placeholder="seu@email.com"
                  />
                </div>
                {!(isSignInWithEmailLink(auth, window.location.href) && !window.localStorage.getItem(EMAIL_FOR_SIGN_IN_KEY)) && (
                  <div className="space-y-2">
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">Senha</label>
                    <input
                      type="password"
                      value={loginPassword}
                      onChange={(event) => setLoginPassword(event.target.value)}
                      autoComplete="current-password"
                      className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-4 text-white focus:outline-none focus:border-[#4bd3ff] transition-colors"
                      placeholder="Sua senha"
                    />
                  </div>
                )}
                {loginInfo && (
                  <p className="text-sm font-bold text-[#4bd3ff] bg-[#4bd3ff]/10 border border-[#4bd3ff]/20 rounded-xl p-3">
                    {loginInfo}
                  </p>
                )}
                {loginError && (
                  <p className="text-sm font-bold text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                    {loginError}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={isLoggingIn || isCompletingEmailLink}
                  className="w-full bg-white text-black py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-gray-200 disabled:opacity-60 disabled:cursor-not-allowed transition-all active:scale-95 shadow-[0_20px_40px_-10px_rgba(255,255,255,0.3)]"
                >
                  {isCompletingEmailLink
                    ? 'Confirmando...'
                    : isLoggingIn
                      ? 'Entrando...'
                      : isSignInWithEmailLink(auth, window.location.href) && !window.localStorage.getItem(EMAIL_FOR_SIGN_IN_KEY)
                        ? 'Confirmar Acesso'
                        : 'Entrar'}
                </button>
              </form>
              <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">Acesso restrito para membros autorizados</p>
           </div>
         </div>
      )}
	      {isAdminPanelOpen && renderAdminPanel()}
	      <audio ref={audioRef} src={audioState.audioUrl} className="hidden" />

	      {user?.requiresPasswordSetup && (
	        <div className="fixed inset-0 z-[1200] bg-[#020507] flex items-center justify-center p-4">
	          <div className="w-full max-w-md bg-[#0b0c10] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
	            <div className="text-center space-y-3">
	              <div className="w-16 h-16 rounded-2xl bg-[#4bd3ff]/10 border border-[#4bd3ff]/20 flex items-center justify-center mx-auto">
	                <Lock size={30} className="text-[#4bd3ff]" />
	              </div>
	              <div>
	                <h2 className="text-2xl font-black text-white uppercase tracking-tight">Crie sua senha</h2>
	                <p className="text-gray-400 text-sm mt-2">Este passo libera seu acesso pela tela inicial nos próximos logins.</p>
	              </div>
	            </div>
	            <form
	              onSubmit={(event) => {
	                event.preventDefault();
	                handleSetInitialPassword();
	              }}
	              className="space-y-4"
	            >
	              <div className="space-y-2">
	                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">Nova senha</label>
	                <input
	                  type="password"
	                  value={newPassword}
	                  onChange={(event) => setNewPassword(event.target.value)}
	                  autoComplete="new-password"
	                  className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-4 text-white focus:outline-none focus:border-[#4bd3ff] transition-colors"
	                />
	              </div>
	              <div className="space-y-2">
	                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">Confirmar senha</label>
	                <input
	                  type="password"
	                  value={newPasswordConfirm}
	                  onChange={(event) => setNewPasswordConfirm(event.target.value)}
	                  autoComplete="new-password"
	                  className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-4 text-white focus:outline-none focus:border-[#4bd3ff] transition-colors"
	                />
	              </div>
	              {passwordSetupError && (
	                <p className="text-sm font-bold text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
	                  {passwordSetupError}
	                </p>
	              )}
	              <button
	                type="submit"
	                disabled={isSettingPassword}
	                className="w-full bg-[#4bd3ff] text-[#020507] py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-[#38bdf8] disabled:opacity-60 transition-colors"
	              >
	                {isSettingPassword ? 'Salvando...' : 'Salvar senha e entrar'}
	              </button>
	            </form>
	          </div>
	        </div>
	      )}

      {/* Mission Modal */}
      <AnimatePresence>
        {isMissionModalOpen && todayChallenge && (
          <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMissionModalOpen(false)}
              className="fixed inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-[#0b0c10] border border-white/10 rounded-none overflow-hidden shadow-2xl z-10 max-h-[90vh] overflow-y-auto"
            >
              <div className="p-8 space-y-8">
                <div className="flex items-center justify-between">
                  <h3 className="text-3xl font-black text-white uppercase tracking-tight">Missão: {todayChallenge.title}</h3>
                  <button onClick={() => setIsMissionModalOpen(false)} className="text-gray-500 hover:text-white transition-colors">
                    <X size={24} />
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="bg-white/5 border border-white/10 p-6 rounded-none space-y-4">
                    <div className="flex items-center gap-3 mb-2">
                       <div className="p-2 bg-[#4bd3ff]/10 text-[#4bd3ff] rounded-lg">
                         <Mic size={20} />
                       </div>
                       <p className="text-white font-bold">Confirmação de Áudio</p>
                    </div>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input 
                        type="checkbox" 
                        checked={audioChecked}
                        onChange={(e) => setAudioChecked(e.target.checked)}
                        className="w-5 h-5 rounded border-white/10 bg-black/40 text-[#4bd3ff] focus:ring-[#4bd3ff]"
                      />
                      <span className="text-white font-medium group-hover:text-[#4bd3ff] transition-colors">Eu ouvi o áudio desta missão.</span>
                    </label>
                  </div>

                  <div className="space-y-6">
                    {todayChallenge.questions.map(q => (
                      <div key={q.id} className="space-y-3">
                        <label className="block text-sm font-black text-gray-400 uppercase tracking-widest">{q.label}</label>
                        
                        {q.type === 'textarea' ? (
	                          <textarea 
	                            value={(missionResponses[q.id] as string) || ''}
                            onChange={(e) => setMissionResponses({...missionResponses, [q.id]: e.target.value})}
                            className="w-full bg-black/40 border border-white/10 rounded-none p-4 text-white text-sm focus:outline-none focus:border-[#4bd3ff] transition-colors min-h-[120px] resize-none"
                            placeholder="Escreva sua resposta aqui..."
                          />
                        ) : q.type === 'radio' ? (
                          <div className="space-y-2">
                            {q.options?.map(opt => (
                              <label key={opt} className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-none cursor-pointer hover:bg-white/10 transition-all">
                                <input 
                                  type="radio" 
                                  name={q.id}
                                  value={opt}
                                  checked={missionResponses[q.id] === opt}
                                  onChange={(e) => setMissionResponses({...missionResponses, [q.id]: e.target.value})}
                                  className="w-4 h-4 border-white/20 bg-black text-[#4bd3ff] focus:ring-[#4bd3ff]"
                                />
                                <span className="text-white text-sm">{opt}</span>
                              </label>
                            ))}
                          </div>
                        ) : q.type === 'checkbox' ? (
                          <div className="space-y-2">
                            {q.options?.map(opt => (
                              <label key={opt} className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-none cursor-pointer hover:bg-white/10 transition-all">
                                <input 
                                  type="checkbox" 
                                  value={opt}
                                  checked={Array.isArray(missionResponses[q.id]) && missionResponses[q.id].includes(opt)}
                                  onChange={(e) => {
                                    const currentValues = Array.isArray(missionResponses[q.id]) ? missionResponses[q.id] : [];
                                    const nextValues = e.target.checked 
                                      ? [...currentValues, opt]
                                      : currentValues.filter((v: string) => v !== opt);
                                    setMissionResponses({...missionResponses, [q.id]: nextValues});
                                  }}
                                  className="w-4 h-4 border-white/20 bg-black text-[#4bd3ff] focus:ring-[#4bd3ff] rounded"
                                />
                                <span className="text-white text-sm">{opt}</span>
                              </label>
                            ))}
                          </div>
                        ) : (
	                          <input 
	                            type="text"
	                            value={(missionResponses[q.id] as string) || ''}
                            onChange={(e) => setMissionResponses({...missionResponses, [q.id]: e.target.value})}
                            className="w-full bg-black/40 border border-white/10 rounded-none p-4 text-white text-sm focus:outline-none focus:border-[#4bd3ff] transition-colors" 
                            placeholder="Sua resposta..."
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <button 
                  onClick={handleSubmitMission}
                  disabled={isSubmittingMission || !audioChecked}
                  className="w-full bg-[#4bd3ff] hover:bg-[#38bdf8] disabled:opacity-50 disabled:cursor-not-allowed text-[#020507] font-black py-4 rounded-none uppercase tracking-[0.2em] text-xs transition-all shadow-[0_20px_40px_-10px_rgba(75,211,255,0.3)]"
                >
                  {isSubmittingMission ? 'Enviando...' : 'Concluir Missão do Dia'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {/* Navigation */}
	      <nav className="fixed top-0 w-full z-50 flex items-center justify-between gap-3 px-3 sm:px-12 py-3 sm:py-4 pt-safe bg-gradient-to-b from-black/85 to-transparent transition-all duration-300 border-b border-white/5 backdrop-blur-sm">
	        <div className="flex min-w-0 items-center gap-4 sm:gap-8">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveTab('jornada')}>
            <img 
	              src="https://brunosimplicio.com.br/wp-content/uploads/2026/05/Logo-horizontal-branca.png" 
              alt="Éden Logo" 
	              className="h-7 sm:h-10 w-auto max-w-[150px] sm:max-w-none object-contain transition-transform hover:scale-105"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
	        <div className="flex shrink-0 items-center gap-2 sm:gap-4 text-white">
          {isAdmin && (
            <button 
              onClick={() => setIsAdminPanelOpen(true)}
	              className="flex items-center gap-2.5 px-3 sm:px-5 py-2.5 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all sm:mr-2 group shadow-xl"
            >
              <Settings size={18} className="text-white/70 group-hover:text-white transition-colors" />
	              <span className="hidden sm:inline text-white font-bold text-sm tracking-tight">Admin</span>
            </button>
          )}

          <div className="flex items-center gap-3 relative">
	            <div className="flex items-center gap-1.5 sm:gap-2 bg-[#0b2831]/80 backdrop-blur-md border border-[#144b5c] px-2.5 sm:px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-black text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.15)] transition-transform hover:scale-105">
              <span className="text-base drop-shadow-sm">🍃</span>
              <span>{user?.points || 0}</span>
            </div>
            
            <div 
              className="flex items-center gap-2 group cursor-pointer"
              onClick={() => setShowProfileDropdown(!showProfileDropdown)}
            >
	              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-[#0d1418] to-[#144b5c] border-2 border-[#4bd3ff]/30 flex items-center justify-center overflow-hidden shadow-2xl transition-all group-hover:scale-110 group-hover:border-[#4bd3ff] active:scale-95 group-hover:shadow-[0_0_20px_rgba(75,211,255,0.3)]">
                {user?.avatar ? (
                  <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white font-black text-sm drop-shadow-md">{user?.name?.charAt(0).toUpperCase()}</span>
                )}
              </div>
            </div>

            {/* Dropdown Menu */}
            {showProfileDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowProfileDropdown(false)}></div>
                <div className="absolute top-full right-0 mt-3 w-64 bg-[#0b2831] border border-[#144b5c] rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="p-4 border-b border-white/5">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Logado como</p>
                    <p className="text-white font-bold truncate">{user?.email}</p>
                  </div>
                  <div className="p-2">
                    {isAdmin && (
                      <button 
                        onClick={() => {
                          setIsAdminPanelOpen(true);
                          setShowProfileDropdown(false);
                        }}
                        className="w-full flex items-center gap-3 p-3 text-emerald-400 hover:bg-emerald-500/10 rounded-xl transition-colors font-bold"
                      >
                        <Settings size={20} />
                        <span>Painel Admin</span>
                      </button>
                    )}
                    <button 
                      onClick={() => {
                        setActiveTab('perfil');
                        setShowProfileDropdown(false);
                      }}
                      className="w-full flex items-center gap-3 p-3 text-gray-300 hover:bg-white/5 rounded-xl transition-colors font-bold"
                    >
                      <User size={20} />
                      <span>Meu Perfil</span>
                    </button>
                    <div className="h-[1px] bg-white/5 my-2 mx-2"></div>
                    <button 
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 p-3 text-red-400 hover:bg-red-500/10 rounded-xl transition-colors font-bold"
                    >
                      <X size={20} />
                      <span>Sair</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section & Header Assets */}
      {activeTab === 'jornada' && (
	        <div className="relative w-full z-0 h-[42vh] min-h-[280px] sm:h-auto sm:aspect-[21/9] overflow-hidden">
          <div className="absolute inset-0">
             <video 
               autoPlay 
               muted 
               loop 
               playsInline 
               className="w-full h-full object-cover opacity-60 scale-105"
             >
	               <source src="https://brunosimplicio.com.br/wp-content/uploads/2026/05/Capa-Hubla.mp4" type="video/mp4" />
             </video>
             <div className="absolute inset-0 bg-gradient-to-t from-[#020507] via-[#020507]/20 to-transparent"></div>
             <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#020507] to-transparent"></div>
          </div>
        </div>
      )}

      {activeTab === 'gameficacao' && (
        <div className="relative w-full z-0 pt-32 pb-24 px-4 sm:px-12 flex justify-center">
          <div className="w-full max-w-2xl bg-[#040e11] border border-white/10 p-6 sm:p-10 rounded-2xl shadow-2xl relative">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 blur-[100px] rounded-full -mr-32 -mt-32"></div>
            
            <div className="space-y-10 relative z-10">
              <div className="flex flex-col items-center space-y-4">
                <div className="flex items-center gap-3">
                  <Leaf size={28} className="text-emerald-400 animate-pulse" />
                  <h2 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
                    Ranking do Éden
                  </h2>
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                  <Crown size={14} className="text-emerald-400" />
                  <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest tracking-[0.2em]">As mulheres mais comprometidas</span>
                </div>
              </div>

              <div className="space-y-4">
                {rankingUsers.length > 0 ? (
                  rankingUsers.map((rUser, idx) => {
                    const medalColors = ['text-yellow-400', 'text-gray-300', 'text-amber-600'];
                    const points = rUser.points || 0;
                    const level = getUserLevel(points);
                    const LevelIcon = level.icon;
                    const isCofounder = rUser.isCofounder;
                    
                    return (
                      <div key={rUser.uid} className="flex items-center gap-4 py-4 px-4 border border-white/5 rounded-xl hover:bg-white/[0.02] transition-all group">
                        <div className="w-10 h-10 flex flex-col items-center justify-center shrink-0">
                          {idx < 3 ? (
                            <div className="flex flex-col items-center">
                               <span className="text-[8px] font-bold text-gray-500 mb-0.5">#{idx + 1}</span>
                               <Trophy size={20} className={medalColors[idx]} />
                            </div>
                          ) : (
                            <span className="text-gray-600 font-black">#{idx + 1}</span>
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <h4 className="text-white font-extrabold text-base sm:text-lg truncate tracking-tight flex items-center gap-2">
                            {rUser.name || 'Membro do Éden'}
                            {isCofounder && (
                               <div className="group relative flex items-center">
                                 <Key size={16} className="text-[#4bd3ff]" />
                                 <div className="pointer-events-none absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-[#0b2831] px-2 py-1 text-[10px] font-bold text-[#4bd3ff] opacity-0 transition-opacity group-hover:opacity-100 border border-[#4bd3ff]/20 z-100 shadow-xl">
                                   Essa é uma co fundadora do Éden
                                 </div>
                               </div>
                            )}
                          </h4>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5">
                            <div className="flex items-center gap-1.5">
                              <LevelIcon size={12} className="text-[#4bd3ff]" />
                              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                                {level.title}
                              </span>
                            </div>
                            {isCofounder && (
                              <div className="flex items-center gap-1.5 opacity-80">
                                <Key size={10} className="text-[#4bd3ff]" />
                                <span className="text-[10px] font-bold text-[#4bd3ff] uppercase tracking-widest">
                                  Co-fundadora
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-emerald-400">
                          <span className="text-xl">🍃</span>
                          <span className="font-black text-xl">{points}</span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-12 text-center border-2 border-dashed border-white/5 rounded-2xl">
                    <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Aguardando as primeiras florescerem...</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

          {/* Progress Overlap Card (Visible on Challenges) */}
          {(activeTab === 'gameficacao') && (
            <div className="px-4 sm:px-12 -mt-24 sm:-mt-32 relative z-30 mb-8 max-w-4xl mx-auto w-full">
              <div className="bg-[#0b0c10]/40 backdrop-blur-3xl border border-white/10 rounded-2xl p-6 sm:p-8 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.8)]">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-[#f1f5f9] tracking-tight mb-2 flex items-center gap-2">
                       {user?.name}
                       {user?.isCofounder && (
                           <div className="group relative flex items-center">
                             <Key size={24} className="text-[#4bd3ff]" />
                             <div className="pointer-events-none absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-[#0b2831] px-2 py-1 text-[10px] font-bold text-[#4bd3ff] opacity-0 transition-opacity group-hover:opacity-100 border border-[#4bd3ff]/20 z-[100] shadow-xl tracking-normal">
                               Essa é uma co fundadora do Éden
                             </div>
                           </div>
                       )}
                    </h2>
                    <div className="inline-block bg-[#0b2831] border border-[#144b5c] text-emerald-400 px-4 py-1.5 rounded-full text-xs font-bold tracking-wide uppercase">
                      {getUserLevel(user?.points || 0).title}
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-emerald-400 text-2xl drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]">🍃</span>
                      <span className="text-3xl font-black text-[#f8fafc]">{user?.points || 0}</span>
                    </div>
                    <span className="text-gray-400 text-[10px] font-bold tracking-widest uppercase">Folhas</span>
                  </div>
                </div>

                {(() => {
                  const nextLvl = getNextLevelInfo(user?.points || 0);
                  const currLvl = getUserLevel(user?.points || 0);
                  return (
                    <>
                      <div className="mb-2 flex items-center justify-between text-xs text-gray-400 font-bold uppercase tracking-wider">
                        <span>Progresso para {nextLvl.nextTitle}</span>
                        <span className="text-[#4bd3ff]">{Math.min(100, Math.round(nextLvl.percentage))}%</span>
                      </div>
                      <div className="h-2.5 bg-black/40 rounded-full overflow-hidden mb-4 border border-white/5 p-[1px]">
                        <div 
                          className="h-full bg-gradient-to-r from-emerald-500 via-[#4bd3ff] to-emerald-400 rounded-full transition-all duration-1000 ease-out shadow-[0_0_20px_rgba(75,211,255,0.4)]"
                          style={{ width: `${Math.min(100, nextLvl.percentage)}%` }}
                        ></div>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-2 mt-2">
                        <div className="flex items-center gap-2 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
                          <div className={`w-2.5 h-2.5 rotate-45 shrink-0 shadow-[0_0_10px_rgba(16,185,129,0.8)] bg-emerald-400`}></div>
                          <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">
                            {currLvl.title}
                          </span>
                        </div>
                        {user?.isCofounder && (
                          <div className="flex items-center gap-2 bg-[#4bd3ff]/10 px-3 py-1.5 rounded-full border border-[#4bd3ff]/20">
                            <Key size={12} className="text-[#4bd3ff]" />
                            <span className="text-[10px] text-[#4bd3ff] font-bold uppercase tracking-widest">
                               Co-fundadora
                            </span>
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          )}

	      <div className={`px-4 sm:px-12 pb-32 ${(activeTab === 'gameficacao' || activeTab === 'guardiao' || activeTab === 'admin' || activeTab === 'jornada') ? (activeTab === 'jornada' ? '-mt-16 sm:-mt-32 pt-0' : 'pt-24') : (activeTab === 'materiais') ? 'pt-0' : 'pt-24'} relative z-30`}>
        {renderContent()}
      </div>

      {/* Module Player Page */}
      {selectedModule && (
        <div className="fixed inset-0 z-[200] bg-[#020507] flex flex-col overflow-hidden animate-in fade-in duration-300">
          {/* Header */}
          <div className="h-16 shrink-0 border-b border-white/5 bg-[#040e11] flex items-center justify-between px-4 sm:px-8 z-10">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setSelectedModule(null)}
                className="p-2 hover:bg-white/5 rounded-full transition text-gray-400 hover:text-white"
              >
                <ChevronLeft size={24} />
              </button>
              <h1 className="text-white font-black uppercase tracking-tight hidden sm:block">
                {selectedModule.title}
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-[#0b2831] border border-[#144b5c] px-3 py-1 rounded-full text-xs font-black text-emerald-400">
                <span>🍃</span> {user?.points || 0}
              </div>
              <button 
                onClick={() => setSelectedModule(null)}
                className="text-gray-400 hover:text-white transition"
              >
                <X size={24} />
              </button>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            {/* Video & Info Column */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-0 sm:p-6 lg:p-8 bg-[#020507]">
              <div className="max-w-5xl mx-auto space-y-6">
                {/* Module Title (Mobile) */}
                <h1 className="text-white font-black uppercase tracking-tight text-xl px-4 sm:px-0 sm:hidden">
                  {selectedModule.title}
                </h1>

                {/* Video Player Box */}
                <div className="relative aspect-video bg-black rounded-none shadow-2xl border border-white/5 bg-[#0b2831]/10">
                   {activeLesson?.videoUrl ? (
                     <iframe 
                      src={activeLesson.videoUrl} 
                      className="absolute inset-0 w-full h-full border-0"
                      allow="autoplay; fullscreen; picture-in-picture; xr-spatial-tracking; clipboard-write" 
                      allowFullScreen
                      title={activeLesson.title}
                    />
                   ) : (
                     <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500">
                       <Video size={64} className="mb-4 opacity-20" />
                       <p className="font-bold uppercase tracking-widest text-sm">Vídeo Indisponível</p>
                     </div>
                   )}
                </div>

                {/* Video Info Bar */}
                <div className="px-4 sm:px-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">
                      {activeLesson?.title}
                    </h2>
                    <p className="text-gray-500 text-sm font-medium mt-1">
                      Módulo: <span className="text-gray-300">{selectedModule.title}</span>
                    </p>
                  </div>
                  
                  <button 
                    onClick={() => {
                      if (activeLesson) toggleChallengeCompletion(activeLesson.id);
                    }}
                    className={`shrink-0 flex items-center justify-center gap-2 px-6 py-3 rounded-sm font-black text-[10px] uppercase tracking-widest transition-all ${
                      user?.completedChallenges?.includes(activeLesson?.id || '') 
                      ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                      : 'bg-[#4bd3ff] text-[#020507] shadow-[0_0_15px_rgba(75,211,255,0.3)] hover:scale-105 active:scale-95'
                    }`}
                  >
                    {user?.completedChallenges?.includes(activeLesson?.id || '') ? (
                      <><CheckCircle size={14} /> Concluída</>
                    ) : (
                      'Marcar como concluída'
                    )}
                  </button>
                </div>

                {/* Description */}
                {activeLesson?.description && (
                  <div className="px-4 sm:px-0 bg-white/5 border border-white/10 rounded-none p-6">
                    <h3 className="text-white font-bold mb-3 uppercase tracking-widest text-xs">Descrição da Aula</h3>
                    <p className="text-gray-300 text-sm sm:text-base leading-relaxed whitespace-pre-wrap">
                      {activeLesson.description}
                    </p>
                  </div>
                )}

                {/* Comments Section */}
                <div id="comments" className="px-4 sm:px-0 pt-8 border-t border-white/5">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                      Comentários 
                      <span className="text-gray-500 text-sm font-bold bg-white/5 px-2 py-0.5 rounded-lg border border-white/5">
                        {comments.length}
                      </span>
                    </h3>
                  </div>

                  {/* Comment Input */}
                  <div className="flex gap-4 mb-10 bg-[#040e11] border border-white/5 p-4 rounded-none shadow-xl">
                    <div className="w-10 h-10 shrink-0 rounded-full bg-gradient-to-br from-[#0d1418] to-[#144b5c] border border-[#4bd3ff]/30 flex items-center justify-center overflow-hidden">
                      {user?.avatar ? (
                        <img src={user.avatar} className="w-full h-full object-cover" alt="" />
                      ) : (
                        <span className="text-white font-black text-xs">{user?.name?.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="flex-1 space-y-3">
                      <textarea 
                        value={commentInput}
                        onChange={(e) => setCommentInput(e.target.value)}
                        placeholder="Escreva seu comentário..."
                        className="w-full bg-black/30 border border-white/10 rounded-none p-4 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#4bd3ff]/50 focus:border-[#4bd3ff]/50 transition-all resize-none h-24"
                      />
                      <div className="flex justify-end">
                    <button 
                      onClick={handleAddComment}
                      disabled={!commentInput.trim() || isSubmittingComment}
                      className="bg-[#4bd3ff] hover:bg-[#38bdf8] disabled:opacity-50 disabled:cursor-not-allowed text-[#020507] font-black py-2.5 px-6 rounded-none text-xs uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(75,211,255,0.2)]"
                    >
                          {isSubmittingComment ? 'Enviando...' : 'Publicar Comentário'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Comments List */}
                  <div className="space-y-6 mb-12">
                    {comments.length > 0 ? (
                      comments.map((comment) => (
                        <div key={comment.id} className="group relative bg-white/5 border border-white/5 hover:border-white/10 p-5 rounded-none transition-all">
                          <div className="flex gap-4">
                            <div className="w-12 h-12 shrink-0 rounded-full bg-black flex items-center justify-center overflow-hidden border border-white/10">
                              {comment.userAvatar ? (
                                <img src={comment.userAvatar} className="w-full h-full object-cover" alt="" />
                              ) : (
                                <span className="text-white font-black text-sm">{comment.userName?.charAt(0).toUpperCase()}</span>
                              )}
                            </div>
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-white font-black text-sm tracking-tight">{comment.userName}</span>
                                  <div className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded-md border border-blue-500/20 text-[10px] font-black uppercase tracking-widest">
                                    <Star size={10} className="fill-current" /> {comment.userInsignia}
                                  </div>
                                  <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-md border border-emerald-500/20 text-[10px] font-black uppercase tracking-widest">
                                    <span>🍃</span> {comment.userPoints}
                                  </div>
                                </div>
                                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest group-hover:text-gray-400 transition-colors">
                                  {comment.createdAt?.toDate ? new Date(comment.createdAt.toDate()).toLocaleDateString() : 'Agora'}
                                </span>
                              </div>
                              <p className="text-gray-300 text-sm sm:text-base leading-relaxed">
                                {comment.text}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-12 bg-white/5 border border-white/5 border-dashed rounded-3xl">
                        <Mic size={48} className="mx-auto text-gray-600 mb-4 opacity-20" />
                        <p className="text-gray-500 font-bold uppercase tracking-widest text-sm">Seja o primeiro a comentar!</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar Column (Curriculum) */}
            <div className="w-full lg:w-96 shrink-0 border-l lg:border-white/5 bg-[#040e11] flex flex-col h-[50vh] lg:h-full">
              <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0 bg-[#061418]">
                <h2 className="text-white font-black uppercase tracking-tight text-sm">Conteúdo do Curso</h2>
                <div className="bg-white/5 px-2 py-0.5 rounded border border-white/5 text-[9px] font-black text-gray-500 uppercase tracking-widest whitespace-nowrap">
                   CONCLUÍDAS: {user?.completedChallenges?.length || 0}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-0">
                {(selectedTrail?.modules || [selectedModule]).map((mod, mIdx) => (
                  <ModuleAccordionItem 
                    key={mod.id}
                    mod={mod}
                    mIdx={mIdx}
                    isCurrentModule={mod.id === selectedModule.id}
                    currentLessonIndex={currentLessonIndex}
                    user={user}
                    onSelectLesson={(m, idx) => {
                      setSelectedModule(m);
                      setCurrentLessonIndex(idx);
                    }}
                    onSelectChallenge={(challenge) => setSelectedLessonChallenge(challenge)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Challenge Popup */}
      <AnimatePresence>
        {selectedLessonChallenge && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedLessonChallenge(null)}
              className="fixed inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-[#0b0c10] border border-white/10 rounded-2xl overflow-hidden shadow-2xl z-10"
            >
              <button 
                onClick={() => setSelectedLessonChallenge(null)}
                className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors z-20"
              >
                <X size={24} />
              </button>

              <div className="aspect-video w-full relative overflow-hidden bg-[#061418]">
                <img 
                  src={selectedLessonChallenge.imageUrl || 'https://images.unsplash.com/photo-1533240332313-0db49b459ad6?auto=format&fit=crop&q=80&w=800'} 
                  className="w-full h-full object-cover opacity-40" 
                  alt="" 
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-[#4bd3ff]/20 border border-[#4bd3ff]/30 flex items-center justify-center shadow-[0_0_30px_rgba(75,211,255,0.2)]">
                    <Trophy size={32} className="text-[#4bd3ff]" />
                  </div>
                </div>
              </div>

              <div className="p-8">
                <div className="flex items-center gap-2 mb-4">
                  <span className="px-2 py-0.5 rounded-full bg-[#4bd3ff]/10 border border-[#4bd3ff]/20 text-[10px] font-black text-[#4bd3ff] uppercase tracking-widest">
                    Desafio Prático
                  </span>
                </div>
                <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-4">
                  {selectedLessonChallenge.title}
                </h3>
                <p className="text-gray-400 text-sm leading-relaxed mb-8">
                  {selectedLessonChallenge.description || 'Preparamos um desafio especial para colocar seus conhecimentos em prática. Complete a tarefa e ganhe pontos para subir de nível no Éden.'}
                </p>

                <div className="space-y-4">
                  <button 
                    onClick={() => {
                      toggleChallengeCompletion(selectedLessonChallenge.id);
                      setSelectedLessonChallenge(null);
                    }}
                    className={`w-full py-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${
                      user?.completedChallenges?.includes(selectedLessonChallenge.id)
                      ? 'bg-emerald-500 text-[#020507]'
                      : 'bg-[#4bd3ff] text-[#020507] hover:scale-[1.02] active:scale-95 shadow-[0_0_20px_rgba(75,211,255,0.2)]'
                    }`}
                  >
                    {user?.completedChallenges?.includes(selectedLessonChallenge.id) 
                      ? 'Desafio Concluído!' 
                      : 'Marcar como Concluído'}
                  </button>
                  <button 
                    onClick={() => setSelectedLessonChallenge(null)}
                    className="w-full py-4 rounded-xl font-black text-[10px] uppercase tracking-widest text-gray-500 hover:text-white transition-colors"
                  >
                    Talvez mais tarde
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Video/Resource Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8">
           <div 
             className="absolute inset-0 bg-black/90 backdrop-blur-sm"
             onClick={() => setSelectedItem(null)}
           />
           <div className="relative w-full max-w-6xl aspect-video bg-[#0b2831]/20 rounded-xl overflow-hidden shadow-2xl border border-gray-800 animate-in fade-in zoom-in-95 duration-200">
             <button 
               onClick={() => setSelectedItem(null)}
               className="absolute top-4 right-4 z-50 p-2 bg-black/50 hover:bg-black text-white rounded-full transition"
             >
               <X size={24} />
             </button>

             {selectedItem.type === 'video' && selectedItem.videoUrl ? (
               <iframe 
                 src={selectedItem.videoUrl} 
                 className="w-full h-full border-0"
                 allow="autoplay; fullscreen; picture-in-picture; xr-spatial-tracking; clipboard-write" 
                 allowFullScreen
                 title={selectedItem.title}
               />
             ) : selectedItem.type === 'material' ? (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#0b2831] to-black p-8">
                  <Download size={64} className="text-white mb-6" />
                  <h2 className="text-3xl font-bold text-white mb-2">{selectedItem.title}</h2>
                  <p className="text-gray-300 mb-8 max-w-md text-center">{selectedItem.description}</p>
                  <button className="bg-emerald-500 hover:bg-emerald-400 text-black px-8 py-3 rounded font-bold transition">
                    Baixar Material
                  </button>
                </div>
             ) : selectedItem.type === 'game' ? (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-[#0b2831] to-black p-8 text-center">
                  <div className="w-32 h-32 rounded-full border-4 border-[#4bd3ff] overflow-hidden mb-6 shadow-[0_0_30px_rgba(75,211,255,0.3)]">
                     <img src={selectedItem.imageUrl} className="w-full h-full object-cover" alt="badge" />
                  </div>
                  <h2 className="text-3xl font-bold text-white mb-2">{selectedItem.title}</h2>
                  <p className="text-emerald-400 font-medium mb-4">Conquista Desbloqueada!</p>
                  <p className="text-gray-300 max-w-md">{selectedItem.description}</p>
                </div>
             ) : null}
           </div>
        </div>
      )}

      {/* Bottom Navigation Navbar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#020709]/95 backdrop-blur-md border-t border-[#0b2831]/50 pb-safe">
        <div className="flex justify-around items-center max-w-lg mx-auto px-2 py-3 sm:max-w-2xl">
          {userTabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center gap-1 transition-colors relative w-16 sm:w-20 ${
                  isActive ? 'text-white' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {isActive && (
                  <div className="absolute -top-3 w-8 h-1 bg-gradient-to-r from-[#4bd3ff] to-emerald-400 rounded-b-full shadow-[0_0_10px_rgba(75,211,255,0.5)]"></div>
                )}
                <div className={`p-1.5 transition-all duration-300 ${isActive ? '-translate-y-1' : ''}`}>
                  <Icon size={24} className={isActive ? 'text-[#4bd3ff]' : ''} />
                </div>
                <span className={`text-[10px] sm:text-xs font-medium transition-all ${isActive ? 'text-[#4bd3ff] opacity-100' : 'opacity-80'}`}>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Modals & Overlays */}
      {isFolhasModalOpen && selectedUser && (
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsFolhasModalOpen(false)}></div>
          <div className="relative w-full max-w-md bg-[#0d1418] border border-white/10 rounded-3xl p-8 shadow-2xl animate-in zoom-in duration-300">
            <button onClick={() => setIsFolhasModalOpen(false)} className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors">
              <X size={24} />
            </button>
            <h3 className="text-2xl font-black text-white tracking-tight mb-8">Adicionar/Remover Folhas</h3>
            
            <div className="bg-white/5 border border-white/5 rounded-2xl p-8 text-center mb-8">
              <p className="text-gray-400 text-sm font-bold uppercase tracking-widest mb-1">Usuário</p>
              <h4 className="text-xl font-black text-white mb-3">{selectedUser.name}</h4>
              <div className="flex items-center justify-center gap-2 text-emerald-400 text-3xl font-black">
                <FileText size={24} className="fill-emerald-400" />
                {selectedUser.points || 0}
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-3 px-1">
                  Quantidade (use números negativos para remover)
                </label>
                <input 
                  type="number" 
                  value={leavesAmount}
                   onChange={(e) => setLeavesAmount(parseInt(e.target.value) || 0)}
                  className="w-full bg-black/40 border-2 border-[#4bd3ff]/30 rounded-xl p-4 text-white text-xl font-black focus:outline-none focus:border-[#4bd3ff] transition-all"
                />
              </div>
              <button 
                onClick={handleUpdateLeaves}
                className="w-full bg-[#4bd3ff] text-[#020507] py-5 rounded-2xl font-black uppercase tracking-widest hover:bg-[#3bc2ee] transition-all transform active:scale-95 shadow-xl"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {isRoleModalOpen && selectedUser && (
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsRoleModalOpen(false)}></div>
          <div className="relative w-full max-w-md bg-[#0d1418] border border-white/10 rounded-3xl p-8 shadow-2xl animate-in zoom-in duration-300">
            <button onClick={() => setIsRoleModalOpen(false)} className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors">
              <X size={24} />
            </button>
            <h3 className="text-2xl font-black text-white tracking-tight mb-8">Gerenciar Role de {selectedUser.name}</h3>
            
            <div className="space-y-6">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 px-1">Roles Atuais</p>
                <div className="flex flex-wrap gap-2">
                  <span className="px-4 py-1.5 bg-white/5 border border-white/10 rounded-full text-[10px] font-black text-gray-300 uppercase tracking-widest">
                    {selectedUser.role === 'admin' ? 'Admin' : 'Aluno'}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 px-1">Alterar Role</p>
                <button 
                  onClick={() => handleUpdateRole('admin')}
                  className="w-full bg-[#4bd3ff] text-[#020507] py-4 rounded-xl font-black uppercase tracking-widest hover:bg-[#3bc2ee] transition-all disabled:opacity-50"
                  disabled={selectedUser.role === 'admin'}
                >
                  Promover para Admin
                </button>
                <button 
                  onClick={() => handleUpdateRole('student')}
                  className="w-full bg-white/5 border border-white/10 text-white py-4 rounded-xl font-black uppercase tracking-widest hover:bg-white/10 transition-all disabled:opacity-50"
                  disabled={selectedUser.role === 'student'}
                >
                  Definir como Aluno
                </button>
              </div>

              <div className="p-5 bg-white/5 border border-white/5 rounded-2xl space-y-2">
                <p className="text-xs text-gray-400 font-medium tracking-tight">
                  <strong className="text-gray-300">Admin:</strong> Acesso completo ao painel administrativo
                </p>
                <p className="text-xs text-gray-400 font-medium tracking-tight">
                  <strong className="text-gray-300">Aluno:</strong> Acesso aos módulos e ao Éden
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {resetEmailSent && (
        <div className="fixed bottom-10 right-10 z-[110] animate-in slide-in-from-right-10 duration-500">
          <div className="bg-[#0d1418] border border-emerald-500/30 p-6 rounded-2xl shadow-2xl max-w-xs ring-1 ring-emerald-500/20">
            <h4 className="text-emerald-400 font-black text-sm uppercase tracking-widest mb-1">Email enviado</h4>
            <p className="text-gray-400 text-xs font-medium leading-relaxed">
              Enviamos um email de acesso para <span className="text-white">{resetEmailSent}</span>
            </p>
          </div>
        </div>
      )}

      {promptConfig && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={promptConfig.onCancel} />
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="w-full max-w-md bg-[#0b0c10] border border-white/10 p-8 rounded-3xl shadow-2xl relative z-10 space-y-6"
          >
            <div>
              <h3 className="text-xl font-black text-white tracking-tight leading-tight">{promptConfig.title}</h3>
              {promptConfig.description && <p className="text-sm text-gray-400 mt-2">{promptConfig.description}</p>}
            </div>
            
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const data: Record<string, string> = {};
                promptConfig.fields.forEach(f => {
                   data[f.name] = formData.get(f.name) as string;
                });
                promptConfig.onSubmit(data);
                setPromptConfig(null);
              }}
              className="space-y-4"
            >
              {promptConfig.fields.map(field => (
                <div key={field.name} className="space-y-2">
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">{field.label}</label>
                  {field.type === 'textarea' ? (
                    <textarea 
                      name={field.name}
                      defaultValue={field.defaultValue}
                      required={field.required}
                      placeholder={field.placeholder}
                      className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-[#4bd3ff] transition-colors min-h-[100px]"
                    />
                  ) : (
                    <input 
                      type={field.type || "text"}
                      name={field.name}
                      defaultValue={field.defaultValue}
                      required={field.required}
                      placeholder={field.placeholder}
                      className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-[#4bd3ff] transition-colors"
                    />
                  )}
                </div>
              ))}
              
              <div className="flex justify-end gap-3 pt-6">
                <button 
                  type="button" 
                  onClick={promptConfig.onCancel}
                  className="px-6 py-3 font-bold text-gray-400 hover:text-white transition-colors uppercase tracking-widest text-xs"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="px-6 py-3 bg-white text-black font-black hover:bg-gray-200 uppercase tracking-widest text-xs rounded-xl shadow-[0_0_20px_rgba(255,255,255,0.2)] transition-all transform hover:scale-105 active:scale-95"
                >
                  {promptConfig.submitText || 'Confirmar'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

    </div>
  );
}

function ModuleAccordionItem({ 
  mod, 
  mIdx, 
  isCurrentModule, 
  currentLessonIndex, 
  user, 
  onSelectLesson,
  onSelectChallenge
}: { 
  mod: Module, 
  mIdx: number, 
  isCurrentModule: boolean, 
  currentLessonIndex: number, 
  user: UserProfile | null,
  onSelectLesson: (mod: Module, idx: number) => void,
  onSelectChallenge: (challenge: ContentItem) => void,
  key?: any
}) {
  const [isExpanded, setIsExpanded] = useState(isCurrentModule);

  return (
    <div className="border-b border-white/5">
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full flex items-center justify-between p-5 text-left transition-all ${
          isCurrentModule ? 'bg-white/[0.03]' : 'hover:bg-white/[0.02]'
        }`}
      >
        <div className="flex items-center gap-4">
          <span className={`text-xs font-black transition-colors ${isCurrentModule ? 'text-[#4bd3ff]' : 'text-gray-600'}`}>{mIdx + 1}</span>
          <div className="text-left">
            <p className={`font-bold text-xs uppercase tracking-tight truncate w-48 ${isCurrentModule ? 'text-white' : 'text-gray-400'}`}>{mod.title}</p>
            <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest mt-0.5">{mod.items.length} conteúdo(s)</p>
          </div>
        </div>
        <ChevronDown size={14} className={`text-gray-600 transition-transform ${isExpanded ? 'rotate-180 text-white' : ''}`} />
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden bg-[#020507]"
          >
            <div className="space-y-[1px]">
              {mod.items.map((lesson, idx) => {
              const isLessonActive = isCurrentModule && currentLessonIndex === idx;
              const isCompleted = user?.completedChallenges?.includes(lesson.id);
              const isChallenge = lesson.type === 'desafio';
              
              return (
                <button 
                  key={lesson.id}
                  onClick={() => {
                    if (isChallenge) {
                      onSelectChallenge(lesson);
                    } else {
                      onSelectLesson(mod, idx);
                    }
                  }}
                  className={`w-full flex items-center gap-4 p-4 transition-all text-left group relative border-l-2 ${
                    isLessonActive 
                    ? 'bg-[#4bd3ff]/10 border-[#4bd3ff]' 
                    : 'border-transparent hover:bg-white/[0.03]'
                  }`}
                >
                  <div className="relative shrink-0 w-20 aspect-video rounded-sm overflow-hidden border border-white/10 bg-black">
                    <img src={lesson.imageUrl || mod.imageUrl} className="w-full h-full object-cover opacity-50 group-hover:opacity-80 transition-opacity" alt="" />
                    <div className="absolute inset-x-0 bottom-0 top-1/2 bg-gradient-to-t from-black to-transparent opacity-60"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className={`w-8 h-8 rounded-full border border-white/20 flex items-center justify-center backdrop-blur-sm transition-all ${
                         isLessonActive ? 'bg-[#4bd3ff] text-black border-[#4bd3ff]' : 'bg-black/40 text-white group-hover:scale-110'
                      }`}>
                        {isChallenge ? (
                          <Trophy size={10} className={isLessonActive ? 'fill-current' : ''} />
                        ) : (
                          <Play size={10} className={isLessonActive ? 'fill-current' : 'ml-0.5'} />
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-bold text-[11px] uppercase tracking-tight truncate ${isLessonActive ? 'text-[#4bd3ff]' : 'text-white'}`}>
                      {lesson.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[9px] font-black uppercase tracking-widest ${isLessonActive ? 'text-[#4bd3ff]/60' : 'text-gray-600'}`}>
                        {isChallenge ? 'Desafio Prático' : `${lesson.duration || '03:00'} min`}
                      </span>
                      {isCompleted && (
                        <CheckCircle size={10} className={isLessonActive ? 'text-[#4bd3ff]/60' : 'text-emerald-500'} />
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Component for a horizontal scrolling Trail row containing Modules
function TrailRow({ trail, onSelectModule, user }: { trail: Trail, onSelectModule: (mod: Module, index?: number) => void, user: UserProfile | null, key?: any }) {
  const rowRef = useRef<HTMLDivElement>(null);
  
  const scroll = (direction: 'left' | 'right') => {
    if (rowRef.current) {
      const { scrollLeft, clientWidth } = rowRef.current;
      const scrollTo = direction === 'left' ? scrollLeft - clientWidth * 0.75 : scrollLeft + clientWidth * 0.75;
      rowRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
    }
  };

  return (
    <div className="mb-10 sm:mb-14 group">
      <div className="mb-4 px-2 tracking-tight">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-200">{trail.title}</h2>
      </div>
      
      <div className="relative">
        <button 
          onClick={() => scroll('left')}
          className="absolute -left-4 sm:-left-10 top-1/2 -translate-y-1/2 z-30 text-white hover:text-gray-300 transition hidden sm:flex items-center justify-center hover:scale-110 drop-shadow-md"
        >
          <ChevronLeft size={36} />
        </button>

        <div 
           ref={rowRef}
           className="flex gap-3 sm:gap-4 overflow-x-auto scrollbar-hide px-2 pb-4 pt-2 -mt-2 smooth-scroll"
           style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {trail.modules.map(mod => (
            <div 
              key={mod.id}
              onClick={() => onSelectModule(mod)}
              className="relative shrink-0 w-36 sm:w-44 md:w-52 aspect-[9/16] rounded-none bg-[#0b2831]/20 cursor-pointer overflow-hidden transition-all duration-300 hover:scale-105 hover:z-20 shadow-lg hover:shadow-2xl group/card border border-white/5 hover:border-white/20"
            >
              <img src={mod.imageUrl} alt={mod.title} className="w-full h-full object-cover transition-transform duration-700 group-hover/card:scale-110 opacity-90 group-hover/card:opacity-100" />
              
              <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
              <div className="absolute inset-x-0 bottom-0 p-3 flex justify-start">
                 <span className="text-[9px] sm:text-[10px] font-bold text-[#4bd3ff] bg-[#4bd3ff]/10 border border-[#4bd3ff]/20 backdrop-blur-sm px-2 py-1 rounded tracking-wider uppercase shadow-lg">
                   {mod.items?.length || 0} Aulas
                 </span>
              </div>
            </div>
          ))}
        </div>

        <button 
          onClick={() => scroll('right')}
          className="absolute -right-4 sm:-right-10 top-1/2 -translate-y-1/2 z-30 text-white hover:text-gray-300 transition hidden sm:flex items-center justify-center hover:scale-110 drop-shadow-md"
        >
          <ChevronRight size={36} />
        </button>
      </div>
    </div>
  );
}

// Component for a horizontal scrolling category row
function CategoryRow({ category, onSelect }: { category: NetflixCategory, onSelect: (item: any) => void, key?: any }) {
  const rowRef = useRef<HTMLDivElement>(null);
  
  const scroll = (direction: 'left' | 'right') => {
    if (rowRef.current) {
      const { scrollLeft, clientWidth } = rowRef.current;
      const scrollTo = direction === 'left' ? scrollLeft - clientWidth * 0.75 : scrollLeft + clientWidth * 0.75;
      rowRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
    }
  };

  return (
    <div className="mb-10 sm:mb-14 group">
      <div className="mb-4 px-2 tracking-tight">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-200">{category.title}</h2>
      </div>
      
      <div className="relative">
        {/* Left Scroll Button */}
        <button 
          onClick={() => scroll('left')}
          className="absolute -left-4 sm:-left-10 top-1/2 -translate-y-1/2 z-30 text-white hover:text-gray-300 transition hidden sm:flex items-center justify-center hover:scale-110 drop-shadow-md"
          aria-label="Voltar"
        >
          <ChevronLeft size={36} />
        </button>

        {/* Scroll Container */}
        <div 
           ref={rowRef}
           className="flex gap-3 sm:gap-4 overflow-x-auto scrollbar-hide px-2 pb-4 pt-2 -mt-2 smooth-scroll"
           style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {category.items.map(item => {
            const isContentItem = 'type' in item;
            return (
              <div 
                key={item.id}
                onClick={() => onSelect(item)}
                className="relative shrink-0 w-36 sm:w-44 md:w-52 aspect-[9/16] rounded-none bg-[#0b2831]/20 cursor-pointer overflow-hidden transition-all duration-300 hover:scale-105 hover:z-20 shadow-lg hover:shadow-2xl group/card border border-white/5 hover:border-white/20"
              >
                <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover transition-transform duration-700 group-hover/card:scale-110 opacity-80 group-hover/card:opacity-100" />
                
                  {/* Bottom Info Gradient - Always Visible */}
                  <div className="absolute inset-x-0 bottom-0 top-1/2 bg-gradient-to-t from-[#020507] via-[#020507]/60 to-transparent flex flex-col justify-end p-4 transition-opacity duration-300">
                     <h4 className="font-extrabold text-base sm:text-lg text-white leading-tight drop-shadow-md decoration-white/30 group-hover/card:underline underline-offset-4">{item.title}</h4>
                     <div className="flex items-center gap-2 mt-2">
                        <span className="text-[9px] sm:text-[10px] font-bold text-[#4bd3ff] bg-[#4bd3ff]/10 border border-[#4bd3ff]/20 px-1.5 py-0.5 rounded tracking-wider uppercase">Novo</span>
                        {isContentItem && (item as ContentItem).duration && <span className="text-[10px] sm:text-xs font-medium text-gray-300 drop-shadow">{(item as ContentItem).duration}</span>}
                     </div>
                  </div>
                </div>
              );
            })}
        </div>

        {/* Right Scroll Button */}
        <button 
          onClick={() => scroll('right')}
          className="absolute -right-4 sm:-right-10 top-1/2 -translate-y-1/2 z-30 text-white hover:text-gray-300 transition hidden sm:flex items-center justify-center hover:scale-110 drop-shadow-md"
          aria-label="Avançar"
        >
          <ChevronRight size={36} />
        </button>
      </div>
    </div>
  );
}
