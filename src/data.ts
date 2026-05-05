import { AudioOfTheDay, NetflixCategory, ContentItem } from "./types";

export const audioOfTheDay: AudioOfTheDay = {
  title: "A Essência da Jornada",
  subtitle: "Mensagem Diária • O Despertar",
  audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
};

export const categoriesJornada: NetflixCategory[] = [
  {
    id: "continue",
    title: "Continue Assistindo",
    items: [
      {
        id: "aula-1",
        title: "O Despertar do Éden",
        description: "A introdução para a sua jornada de transformação.",
        imageUrl: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=80&w=600&h=900",
        videoUrl: "https://play.tynk.ai/p/77447fb5-f24e-43c4-b1a8-4f3917c4dace",
        type: 'video',
        duration: "15:30",
        isCompleted: false,
      }
    ]
  },
  {
    id: "fase-1",
    title: "Fase 1: As Raízes",
    items: [
      {
        id: "aula-2",
        title: "Semeando ideias",
        description: "Construindo uma base sólida para a sua mentalidade.",
        imageUrl: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&q=80&w=600&h=900",
        videoUrl: "https://play.tynk.ai/p/77447fb5-f24e-43c4-b1a8-4f3917c4dace",
        type: 'video',
        duration: "12:00",
      },
      {
        id: "aula-3",
        title: "Regando a mente",
        description: "Hábitos e rotinas de sucesso diário.",
        imageUrl: "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?auto=format&fit=crop&q=80&w=600&h=900",
        videoUrl: "https://play.tynk.ai/p/77447fb5-f24e-43c4-b1a8-4f3917c4dace",
        type: 'video',
        duration: "18:45",
      },
      {
        id: "aula-4",
        title: "A Luz do Sol",
        description: "Buscando energia e inspiração na natureza e na vida.",
        imageUrl: "https://images.unsplash.com/photo-1501854140801-50d01698950b?auto=format&fit=crop&q=80&w=600&h=900",
        videoUrl: "https://play.tynk.ai/p/77447fb5-f24e-43c4-b1a8-4f3917c4dace",
        type: 'video',
        duration: "10:15",
      }
    ]
  }
];

export const materiaisDeApoio: NetflixCategory[] = [
  {
    id: "pdfs",
    title: "Guias Práticos",
    items: [
      {
        id: "pdf-1",
        title: "Mapa Mental da Fase 1",
        description: "Um guia visual detalhado para a fase inicial.",
        imageUrl: "https://images.unsplash.com/photo-1586281380349-632531db7ed4?auto=format&fit=crop&q=80&w=600&h=900",
        type: 'material',
      },
      {
        id: "pdf-2",
        title: "Planner Diário",
        description: "Folheto de organização para imprimir.",
        imageUrl: "https://images.unsplash.com/photo-1512314889357-e157c22f938d?auto=format&fit=crop&q=80&w=600&h=900",
        type: 'material',
      }
    ]
  }
];

export const desafios14Dias: ContentItem[] = Array.from({ length: 14 }).map((_, i) => ({
  id: `desafio-${i + 1}`,
  title: `Dia ${i + 1}: ${[
    'O Despertar da Consciência',
    'A Força do Hábito',
    'Mente Blindada',
    'Foco e Disciplina',
    'Superação de Limites',
    'O Poder da Ação',
    'Equilíbrio Emocional',
    'Gratidão e Presença',
    'Visão de Futuro',
    'Comunicação Assertiva',
    'Relacionamentos Saudáveis',
    'Gestão do Tempo',
    'Propósito Inabalável',
    'O Renascimento no Éden'
  ][i]}`,
  description: `Assista ao vídeo e complete o desafio prático do dia ${i + 1} para ganhar 22 folhas.`,
  imageUrl: `https://images.unsplash.com/photo-${[
    '1499209974431-9dac36b3240e',
    '1552664730-d307ca884978',
    '1493612276216-ee3925520721',
    '1484417894907-623942c8ee29',
    '1526506118085-60ce8714f8c5',
    '1519389483123-cdd80ad1d670',
    '1499209974431-9dac36b3240e',
    '1493612276216-ee3925520721',
    '1484417894907-623942c8ee29',
    '1526506118085-60ce8714f8c5',
    '1519389483123-cdd80ad1d670',
    '1499209974431-9dac36b3240e',
    '1493612276216-ee3925520721',
    '1484417894907-623942c8ee29'
  ][i]}?auto=format&fit=crop&q=80&w=600&h=900`,
  videoUrl: "https://play.tynk.ai/p/77447fb5-f24e-43c4-b1a8-4f3917c4dace",
  type: 'video',
  duration: "10:00",
}));
