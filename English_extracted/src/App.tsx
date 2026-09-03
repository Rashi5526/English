import { useState, useRef, useEffect } from 'react';
import { callNova } from './lib/claude';
import type { NovaResponse, ClaudeMessage } from './lib/claude';
import { getPushStatus, subscribeToPush, unsubscribeFromPush } from './lib/push';
import type { PushStatus } from './lib/push';

// ── Types ──────────────────────────────────────────────────────────────────
type AppPhase = 'onboarding' | 'personalization' | 'main';
type MainScreen = 'home' | 'chat' | 'learn' | 'saved' | 'profile';
type LearnTab = 'library' | 'lookup';
type LibraryCategory = 'EVERYDAY' | 'REACTIONS' | 'SLANG' | 'EMOTIONAL' | 'INTERNET';

interface ChatMessage {
  id: string;
  sender: 'nova' | 'user';
  text: string;
  time: string;
  novaData?: NovaResponse;
  isError?: boolean;
  retryPayload?: { userMsg: string; history: ClaudeMessage[] };
}

// ── Static data ────────────────────────────────────────────────────────────
const STYLE_OPTIONS = [
  { id: 'casual',    label: 'Casual',    example: 'yeahh I\'m down' },
  { id: 'funny',     label: 'Funny',     example: 'bro what 😭' },
  { id: 'confident', label: 'Confident', example: 'yeah, that works for me' },
  { id: 'soft',      label: 'Soft',      example: 'aww that\'s actually so sweet' },
  { id: 'flirty',    label: 'Flirty',    example: 'okayyy I see you 👀' },
];

const AUDIENCE_OPTIONS = ['Best friend', 'Friends', 'Partner', 'People online', 'College', 'Work', 'Everyone'];

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: '1',
    sender: 'nova',
    text: "brooo I was supposed to finish everything today and now I'm just lying in bed 💀",
    time: '2:34 PM',
  },
];

const NOVA_REPLIES = [
  "lmaooo right?? 😭 I keep telling myself I'll start in 5 mins and then it's been 3 hours",
  "fr fr same situation. I'm literally just doom scrolling at this point 💀",
  "bro we need to get our lives together 😭 but like... tomorrow tho",
  "LMAOO that's actually so valid. I'm not even gonna judge 💀",
  "okay but no cap that's literally me every single day 😭",
];

const LIBRARY_DATA: Record<LibraryCategory, { term: string; definition: string; example: string }[]> = {
  EVERYDAY: [
    { term: 'wyd',  definition: 'what you doing',   example: '"wyd tonight?" = "what are you doing tonight?"' },
    { term: 'idk',  definition: 'I don\'t know',     example: '"idk tbh" = "I don\'t know, to be honest"' },
    { term: 'tbh',  definition: 'to be honest',      example: '"tbh I don\'t care" = "honestly, I don\'t care"' },
    { term: 'ngl',  definition: 'not gonna lie',     example: '"ngl that was good" = "honestly that was good"' },
    { term: 'fr',   definition: 'for real',          example: '"fr fr" = "seriously / I really mean it"' },
    { term: 'btw',  definition: 'by the way',        example: '"btw did you see that?" = "by the way, did you see that?"' },
  ],
  REACTIONS: [
    { term: 'lmao',   definition: 'laughing my ass off',        example: '"lmao I can\'t" = "hahaha I\'m losing it"' },
    { term: 'brooo',  definition: 'disbelief or shock',          example: '"brooo no way" = "oh my god, seriously?"' },
    { term: 'dead',   definition: 'something is hilarious',      example: '"I\'m dead 💀" = "that\'s so funny"' },
    { term: 'crying', definition: 'laughing or overwhelmed',     example: '"I\'m crying 😭" = "this is too much"' },
    { term: 'HELP',   definition: 'playful overwhelm',           example: '"HELP" = "this is too funny / chaotic"' },
  ],
  SLANG: [
    { term: 'lowkey',  definition: 'kind of / secretly',   example: '"I\'m lowkey tired" = "I\'m actually kind of tired"' },
    { term: 'highkey', definition: 'very much / openly',   example: '"highkey obsessed" = "I\'m very obviously into this"' },
    { term: 'cooked',  definition: 'in serious trouble',   example: '"I\'m cooked 😭" = "I\'m screwed"' },
    { term: 'ate',     definition: 'did something amazingly', example: '"she ate that" = "she absolutely killed it"' },
    { term: 'fire',    definition: 'amazing / excellent',  example: '"this is fire" = "this is really good"' },
    { term: 'bet',     definition: 'okay / agreed',        example: '"bet" = "alright, cool"' },
  ],
  EMOTIONAL: [
    { term: 'I\'m drained',      definition: 'exhausted',              example: '"I\'m so drained today" = "I have no energy left"' },
    { term: 'I\'m overwhelmed',  definition: 'too much is happening',  example: '"I\'m overwhelmed rn" = "I can\'t handle everything"' },
    { term: 'I can\'t deal',     definition: 'this is too much',       example: '"I can\'t deal 😭" = "I cannot handle this"' },
    { term: 'that made my day',  definition: 'something made me happy', example: '"aww that made my day" = "that really brightened my mood"' },
  ],
  INTERNET: [
    { term: 'it\'s giving',          definition: 'it looks like / reminds me of',  example: '"it\'s giving main character" = "very main character energy"' },
    { term: 'main character',        definition: 'acting central and iconic',       example: '"she\'s giving main character" = "she\'s confident and iconic"' },
    { term: 'delulu',                definition: 'delusional (playful)',             example: '"I\'m so delulu" = "I\'m being totally unrealistic"' },
    { term: 'no thoughts, head empty', definition: 'completely spacing out',        example: '"no thoughts, head empty" = "my brain is blank rn"' },
  ],
};

const LOOKUP_DATA: Record<string, { pronunciation: string; meaning: string; examples: string[]; vibes: string[]; practice: string }> = {
  lowkey: {
    pronunciation: '/ˌloʊˈkiː/',
    meaning: 'Kind of / secretly / actually, but not too openly.',
    examples: [
      '"I\'m lowkey tired." = I\'m actually kind of tired.',
      '"I lowkey love this." = I actually really like this.',
    ],
    vibes: ['🫶 casual', '💬 very common', '✨ natural with friends'],
    practice: 'I\'m lowkey obsessed with this.',
  },
  wyd: {
    pronunciation: '/ˌdʌbljuˈwaɪˈdiː/',
    meaning: 'What you doing? — a casual check-in or soft invitation.',
    examples: [
      '"wyd tonight?" = "What are you doing tonight?"',
      '"wyd rn?" = "What are you doing right now?"',
    ],
    vibes: ['💬 very casual', '📱 texting only', '👋 starts conversations'],
    practice: 'wyd this weekend?',
  },
  bet: {
    pronunciation: '/bɛt/',
    meaning: 'Okay / agreed / sounds good. A casual way to confirm.',
    examples: [
      '"bet" = "okay, cool"',
      '"bet, I\'ll see you there" = "alright, see you there"',
    ],
    vibes: ['✅ agreement', '🤙 super casual', '💬 very common'],
    practice: 'bet, I\'m in.',
  },
  cooked: {
    pronunciation: '/kʊkt/',
    meaning: 'In serious trouble / done for / things are going badly.',
    examples: [
      '"I\'m literally cooked 😭" = "I\'m seriously screwed"',
      '"we\'re so cooked" = "we\'re in big trouble"',
    ],
    vibes: ['😭 dramatic', '💀 skull emoji friend', '🔥 very Gen-Z'],
    practice: 'I forgot to study and the exam is in 10 mins. I\'m cooked.',
  },
  'no cap': {
    pronunciation: '/noʊ kæp/',
    meaning: 'No lie / I\'m being serious / for real.',
    examples: [
      '"no cap that was the best" = "honestly, that was amazing"',
      '"I love you no cap" = "I genuinely love you"',
    ],
    vibes: ['🤝 sincere', '💯 emphasis', '💬 very common'],
    practice: 'no cap, this is the best thing I\'ve ever tasted.',
  },
  ate: {
    pronunciation: '/eɪt/',
    meaning: 'Did something really well / absolutely nailed it.',
    examples: [
      '"she ate that" = "she absolutely killed it"',
      '"you ate and left no crumbs" = "you did that perfectly"',
    ],
    vibes: ['✨ compliment', '🔥 enthusiastic', '💅 fashion/performance'],
    practice: 'bro you ate that presentation.',
  },
};

const SAVED_SECTIONS = [
  { icon: '♡', label: 'Want to remember', phrases: ['I\'m down', 'No worries', 'That\'s lowkey cute'] },
  { icon: '💬', label: 'Can actually use',  phrases: ['bet', 'wyd', 'fr fr'] },
  { icon: '😭', label: 'Funny expressions', phrases: ['I\'m cooked', 'help 😭', 'brooo no way'] },
  { icon: '✨', label: 'Beautiful phrases',  phrases: ['that made my day', 'you\'re doing amazing', 'I appreciate you'] },
  { icon: '🔥', label: 'Slang',             phrases: ['it\'s giving', 'ate', 'fire'] },
];

// ── Icons ──────────────────────────────────────────────────────────────────
const HomeIcon = ({ active }: { active: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? '#1A1714' : 'none'} stroke={active ? '#1A1714' : '#B8A99B'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
    <path d="M9 21V12h6v9" />
  </svg>
);
const ChatIcon = ({ active }: { active: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? '#1A1714' : 'none'} stroke={active ? '#1A1714' : '#B8A99B'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
  </svg>
);
const LearnIcon = ({ active }: { active: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? '#1A1714' : 'none'} stroke={active ? '#1A1714' : '#B8A99B'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
  </svg>
);
const SavedIcon = ({ active }: { active: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? '#1A1714' : 'none'} stroke={active ? '#1A1714' : '#B8A99B'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
  </svg>
);
const ProfileIcon = ({ active }: { active: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? '#1A1714' : 'none'} stroke={active ? '#1A1714' : '#B8A99B'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);
const SendIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);
const ChevronRight = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#B8A99B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);
const HeartIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#B8A99B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
  </svg>
);

// ── Bottom nav ─────────────────────────────────────────────────────────────
function BottomNav({ current, onNavigate }: { current: MainScreen; onNavigate: (s: MainScreen) => void }) {
  const items: { id: MainScreen; label: string; Icon: React.FC<{ active: boolean }> }[] = [
    { id: 'home',    label: 'Home',    Icon: HomeIcon },
    { id: 'chat',    label: 'Chat',    Icon: ChatIcon },
    { id: 'learn',   label: 'Learn',   Icon: LearnIcon },
    { id: 'saved',   label: 'Saved',   Icon: SavedIcon },
    { id: 'profile', label: 'Profile', Icon: ProfileIcon },
  ];
  return (
    <div className="bg-[#FDFBF6]/95 backdrop-blur-xl border-t border-[#E5DDD0] px-2 pt-3 pb-7 flex justify-around flex-shrink-0">
      {items.map(({ id, label, Icon }) => (
        <button
          key={id}
          onClick={() => onNavigate(id)}
          className="flex flex-col items-center gap-1 min-w-[52px] transition-all duration-150 active:scale-95"
        >
          <Icon active={current === id} />
          <span
            className="text-[10px] tracking-wide"
            style={{ color: current === id ? '#1A1714' : '#B8A99B', fontWeight: current === id ? 500 : 400 }}
          >
            {label}
          </span>
        </button>
      ))}
    </div>
  );
}

// ── Screen: Onboarding ─────────────────────────────────────────────────────
function WelcomeScreen({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-col h-full bg-ivory px-8 pt-16 pb-12 justify-between">
      <div>
        <div className="mb-14">
          <span className="text-taupe text-xs tracking-[0.25em] font-medium uppercase">lowkey</span>
        </div>
        <h1 className="font-serif text-charcoal text-[2.6rem] leading-[1.08] font-normal mb-5">
          English, but the way people{' '}
          <em className="italic text-[#C4A26A]">actually</em>{' '}
          talk.
        </h1>
        <p className="text-taupe text-[15px] leading-relaxed font-light">
          Learn the words, slang, shortcuts and little phrases that make conversations feel natural.
        </p>
      </div>

      {/* Floating quote bubbles */}
      <div className="flex flex-col gap-3 my-10">
        <div className="bg-gold-pale rounded-2xl px-5 py-3 self-start shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
          <span className="text-charcoal text-sm font-light">"I'm lowkey obsessed with this app 😭"</span>
        </div>
        <div className="bg-[#F0E8D8] rounded-2xl px-5 py-3 self-start ml-7 shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
          <span className="text-charcoal text-sm font-light">"bro I actually understood that"</span>
        </div>
        <div className="bg-gold-pale rounded-2xl px-5 py-3 self-start ml-3 shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
          <span className="text-charcoal text-sm font-light">"wait... that's what they meant 👀"</span>
        </div>
      </div>

      <div>
        <button
          onClick={onNext}
          className="w-full bg-charcoal text-ivory-light rounded-2xl py-4 text-[15px] font-medium tracking-wide transition-all duration-200 hover:bg-charcoal-soft active:scale-[0.98] shadow-[0_4px_24px_rgba(26,23,20,0.18)]"
        >
          Let's get you fluent →
        </button>
        <p className="text-center text-taupe-light text-xs mt-4 font-light">
          No lessons. No pressure. Just conversations.
        </p>
      </div>
    </div>
  );
}

// ── Screen: Personalization ────────────────────────────────────────────────
function PersonalizationScreen({ onNext }: { onNext: () => void }) {
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [selectedAudiences, setSelectedAudiences] = useState<string[]>([]);

  const toggleStyle = (id: string) =>
    setSelectedStyles(p => p.includes(id) ? p.filter(s => s !== id) : [...p, id]);
  const toggleAudience = (a: string) =>
    setSelectedAudiences(p => p.includes(a) ? p.filter(s => s !== a) : [...p, a]);

  return (
    <div className="flex flex-col h-full bg-ivory">
      <div className="flex-1 overflow-y-auto px-6 pt-14 pb-4">
        <div className="mb-8">
          <span className="text-gold text-[10px] tracking-[0.25em] uppercase font-medium">almost there</span>
          <h1 className="font-serif text-charcoal text-[2rem] leading-tight font-normal mt-2">
            How do you want<br />to sound?
          </h1>
        </div>

        {/* Style cards — 2-col grid, last card spans full width */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          {STYLE_OPTIONS.map(({ id, label, example }) => {
            const active = selectedStyles.includes(id);
            return (
              <button
                key={id}
                onClick={() => toggleStyle(id)}
                className={`rounded-2xl p-4 text-left transition-all duration-200 border active:scale-[0.97] ${id === 'flirty' ? 'col-span-2' : ''} ${
                  active
                    ? 'bg-charcoal border-charcoal'
                    : 'bg-ivory-light border-border hover:border-gold'
                }`}
              >
                <div className={`text-sm font-medium mb-1 ${active ? 'text-ivory-light' : 'text-charcoal'}`}>
                  {label}
                </div>
                <div className={`text-xs font-light leading-snug ${active ? 'text-taupe-light' : 'text-taupe'}`}>
                  "{example}"
                </div>
              </button>
            );
          })}
        </div>

        {/* Audience */}
        <div className="mb-8">
          <p className="text-charcoal font-medium text-sm mb-3">Who do you mostly talk to?</p>
          <div className="flex flex-wrap gap-2">
            {AUDIENCE_OPTIONS.map(a => {
              const active = selectedAudiences.includes(a);
              return (
                <button
                  key={a}
                  onClick={() => toggleAudience(a)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-150 border active:scale-95 ${
                    active
                      ? 'bg-charcoal text-ivory-light border-charcoal'
                      : 'bg-transparent text-taupe border-border hover:border-taupe'
                  }`}
                >
                  {a}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Sticky CTA */}
      <div className="bg-ivory/90 backdrop-blur-xl px-6 pt-4 pb-10 border-t border-border flex-shrink-0">
        <button
          onClick={onNext}
          disabled={selectedStyles.length === 0}
          className={`w-full rounded-2xl py-4 text-[15px] font-medium tracking-wide transition-all duration-200 ${
            selectedStyles.length > 0
              ? 'bg-charcoal text-ivory-light hover:bg-charcoal-soft active:scale-[0.98]'
              : 'bg-border text-taupe-light cursor-not-allowed'
          }`}
        >
          {selectedStyles.length > 0 ? 'Let\'s go →' : 'Pick at least one style'}
        </button>
      </div>
    </div>
  );
}

// ── Screen: Home ───────────────────────────────────────────────────────────
function HomeScreen({ onNavigate }: { onNavigate: (s: MainScreen) => void }) {
  return (
    <div className="h-full overflow-y-auto bg-ivory">
      <div className="px-5 pt-14 pb-6">
        {/* Greeting */}
        <div className="mb-7">
          <h1 className="font-serif text-charcoal text-[2rem] font-normal italic leading-snug">
            Good evening, Maya
          </h1>
          <p className="text-taupe text-[13px] font-light mt-1">let's make English feel effortless.</p>
        </div>

        {/* Today's Phrase — hero card */}
        <div className="bg-charcoal rounded-3xl p-6 mb-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-gold/10 -translate-y-10 translate-x-10 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full bg-[#C4A26A]/5 translate-y-8 -translate-x-8 pointer-events-none" />
          <div className="relative">
            <span className="text-gold text-[10px] tracking-[0.2em] uppercase font-medium">Today's phrase</span>
            <h2 className="font-serif text-ivory-light text-[2.2rem] font-normal mt-2 mb-5 leading-tight">
              "I'm dead 😭"
            </h2>
            <div className="space-y-3 mb-6">
              <div>
                <span className="text-taupe-light text-[10px] uppercase tracking-widest">Meaning</span>
                <p className="text-ivory-light text-sm font-light mt-0.5">"I can't stop laughing."</p>
              </div>
              <div>
                <span className="text-taupe-light text-[10px] uppercase tracking-widest">Used when</span>
                <p className="text-ivory-light text-sm font-light mt-0.5">Something is extremely funny.</p>
              </div>
            </div>
            <button
              onClick={() => onNavigate('chat')}
              className="text-gold text-sm font-medium flex items-center gap-1 transition-opacity hover:opacity-70"
            >
              See how people use it →
            </button>
          </div>
        </div>

        {/* Daily progress */}
        <div className="bg-champagne rounded-2xl p-5 mb-4 border border-border">
          <div className="flex items-center justify-between mb-3">
            <span className="text-charcoal text-sm font-medium">Daily 5 minutes</span>
            <span className="text-gold text-xs font-medium">2 / 5 done</span>
          </div>
          <div className="flex gap-1.5 mb-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= 2 ? 'bg-gold' : 'bg-border'}`} />
            ))}
          </div>
          <p className="text-taupe text-xs font-light">Keep going — 3 tasks left 🤍</p>
        </div>

        {/* Section cards */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: '💬', title: 'Chat with AI',       sub: 'Just talk. I\'ll help you understand.',   screen: 'chat'  as MainScreen },
            { icon: '✨', title: 'Phrases Learned',     sub: '47 expressions unlocked',                  screen: 'learn' as MainScreen, highlight: true },
            { icon: '🧠', title: 'Your Words',          sub: 'Vocabulary you\'ve struggled with.',       screen: 'saved' as MainScreen },
            { icon: '📖', title: 'Your Conversations',  sub: 'Past chats & things you\'ve learned.',     screen: 'profile' as MainScreen },
          ].map(({ icon, title, sub, screen, highlight }) => (
            <button
              key={title}
              onClick={() => onNavigate(screen)}
              className="bg-ivory-light rounded-2xl p-4 text-left border border-border hover:border-gold active:scale-[0.97] transition-all duration-150"
            >
              <div className="text-xl mb-2">{icon}</div>
              <div className="text-charcoal text-[13px] font-medium leading-snug">{title}</div>
              <div className={`text-xs font-light mt-1 leading-snug ${highlight ? 'text-gold' : 'text-taupe'}`}>{sub}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Screen: Chat ───────────────────────────────────────────────────────────
function ChatScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [showExplanation, setShowExplanation] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<ClaudeMessage[]>([]);
  const [errorMemory, setErrorMemory] = useState<string[]>([]);
  const [lastNovaResponse, setLastNovaResponse] = useState<NovaResponse | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = async (prefilled?: string) => {
    const text = (prefilled ?? input).trim();
    if (!text || isTyping) return;

    const now = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    setMessages(p => [...p, { id: Date.now().toString(), sender: 'user', text, time: now }]);
    if (!prefilled) setInput('');
    setIsTyping(true);

    const historySnapshot = [...conversationHistory];

    try {
      const novaResp = await callNova(text, historySnapshot, errorMemory);
      const novaMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'nova',
        text: novaResp.response,
        time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        novaData: novaResp,
      };
      setMessages(p => [...p, novaMsg]);
      setLastNovaResponse(novaResp);
      setConversationHistory(p => [
        ...p,
        { role: 'user', content: text },
        { role: 'assistant', content: novaResp.response },
      ]);
      // Track recurring grammar error patterns
      if (novaResp.corrections.length > 0) {
        const cats = novaResp.corrections
          .map(c => {
            const ex = c.explanation.toLowerCase();
            if (ex.includes('past tense') || ex.includes('tense')) return 'past tense';
            if (ex.includes('article')) return 'articles';
            if (ex.includes('preposition')) return 'prepositions';
            if (ex.includes('word order') || ex.includes('structure')) return 'word order';
            if (ex.includes('collocation')) return 'collocations';
            if (ex.includes('was/were') || ex.includes('were')) return 'was/were';
            return '';
          })
          .filter(Boolean);
        setErrorMemory(p => [...new Set([...p, ...cats])].slice(-5));
      }
    } catch (err) {
      const isNoKey = err instanceof Error && err.message.toLowerCase().includes('anthropic_api_key');
      const errorText = isNoKey
        ? "hey! the server's missing its API key 😭\n\nAdd ANTHROPIC_API_KEY as a server environment variable in your hosting dashboard and redeploy 🤍"
        : "something went wrong on my end 😭 tap to retry →";
      setMessages(p => [
        ...p,
        {
          id: (Date.now() + 1).toString(),
          sender: 'nova',
          text: errorText,
          time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
          isError: !isNoKey,
          retryPayload: !isNoKey ? { userMsg: text, history: historySnapshot } : undefined,
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleRetry = (payload: { userMsg: string; history: ClaudeMessage[] }) => {
    setMessages(p => p.slice(0, -1));
    setConversationHistory(payload.history);
    handleSend(payload.userMsg);
  };

  // Build explanation panel data from last real Nova response, or fall back to static
  const explanationPhrases =
    lastNovaResponse?.slang_explanations.length
      ? lastNovaResponse.slang_explanations.map(s => ({
          phrase: `"${s.term}"`,
          meaning: `= ${s.meaning}${s.context ? ` (${s.context})` : ''}`,
        }))
      : [
          { phrase: '"I was supposed to..."', meaning: '= I planned / was expected to...' },
          { phrase: '"I\'m just lying in bed"', meaning: '= I\'m doing nothing productive 😭' },
          { phrase: '"💀"', meaning: 'Here: "I\'m dead / this is ridiculous / laughing at myself."' },
        ];

  const explanationReplies =
    lastNovaResponse?.reply_options.length
      ? lastNovaResponse.reply_options.map(r => ({ text: r.text, tone: r.tone.toLowerCase() }))
      : [
          { text: 'LMAOO same 😭', tone: 'empathetic' },
          { text: 'bro get up 💀', tone: 'playful' },
          { text: "you're actually so lazy", tone: 'affectionate' },
        ];

  return (
    <div className="flex flex-col h-full bg-ivory relative">
      {/* Header */}
      <div className="px-5 pt-14 pb-4 border-b border-border bg-ivory flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-charcoal flex items-center justify-center text-gold font-serif text-base font-normal flex-shrink-0">
            N
          </div>
          <div>
            <div className="text-charcoal text-[15px] font-medium">Nova</div>
            <div className="text-taupe text-xs font-light italic">your english bestie</div>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#8FB87E]" />
            <span className="text-taupe text-[11px]">online</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex items-end gap-2 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.sender === 'nova' && (
              <div className="w-7 h-7 rounded-full bg-charcoal flex items-center justify-center text-gold text-xs font-serif flex-shrink-0 mb-0.5">
                N
              </div>
            )}
            <div className="max-w-[76%]">
              {/* Chat bubble */}
              <div
                className={`px-4 py-3 rounded-2xl text-[14px] leading-relaxed ${
                  msg.sender === 'nova'
                    ? 'bg-ivory-light text-charcoal border border-border rounded-tl-sm'
                    : 'bg-charcoal text-ivory-light rounded-tr-sm'
                }`}
              >
                {msg.text}
                {msg.isError && msg.retryPayload && (
                  <button
                    onClick={() => handleRetry(msg.retryPayload!)}
                    className="mt-2 text-gold text-[12px] font-medium flex items-center gap-1 underline underline-offset-2"
                  >
                    try again →
                  </button>
                )}
              </div>
              <div
                className={`text-[10px] text-taupe-light mt-1 ${msg.sender === 'user' ? 'text-right' : 'text-left'}`}
              >
                {msg.time}
              </div>

              {/* Grammar correction card */}
              {msg.sender === 'nova' && msg.novaData?.corrections.length ? (
                <div className="mt-2 bg-champagne border border-gold/25 rounded-xl px-3.5 py-3 space-y-2">
                  <div className="text-gold text-[10px] uppercase tracking-widest font-medium">tiny tweak 👀</div>
                  {msg.novaData.corrections.slice(0, 3).map((c, i) => (
                    <div key={i}>
                      <div className="text-[12px]">
                        <span className="text-taupe-light line-through">{c.original}</span>
                        <span className="text-charcoal font-medium"> → {c.corrected}</span>
                      </div>
                      {c.explanation && (
                        <div className="text-taupe text-[11px] font-light mt-0.5">{c.explanation}</div>
                      )}
                    </div>
                  ))}
                </div>
              ) : null}

              {/* Reply option chips */}
              {msg.sender === 'nova' && msg.novaData?.reply_options.length ? (
                <div className="mt-2 flex flex-col gap-1.5">
                  {msg.novaData.reply_options.map((r, i) => (
                    <button
                      key={i}
                      onClick={() => setInput(r.text)}
                      className="bg-gold-pale border border-gold/20 rounded-xl px-3.5 py-2 text-left flex items-center justify-between gap-2 hover:border-gold transition-colors active:scale-[0.98]"
                    >
                      <span className="text-charcoal text-[12px] font-medium leading-snug">{r.text}</span>
                      <span className="text-taupe text-[10px] font-light flex-shrink-0">{r.tone}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex items-end gap-2 justify-start">
            <div className="w-7 h-7 rounded-full bg-charcoal flex items-center justify-center text-gold text-xs font-serif flex-shrink-0">
              N
            </div>
            <div className="bg-ivory-light border border-border rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-taupe-light"
                  style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* "I don't get this" */}
      <div className="flex justify-center px-4 py-2 flex-shrink-0">
        <button
          onClick={() => setShowExplanation(true)}
          className="flex items-center gap-2 bg-ivory-light border border-border rounded-full px-5 py-2.5 text-taupe text-xs font-medium hover:border-gold hover:text-gold transition-all duration-150"
        >
          <span>💡</span>
          I don't get this
        </button>
      </div>

      {/* Input bar */}
      <div className="px-4 pb-5 flex-shrink-0">
        <div className="flex items-center gap-2 bg-ivory-light border border-border rounded-2xl px-4 py-3 focus-within:border-taupe transition-colors">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Type something..."
            className="flex-1 bg-transparent text-charcoal text-sm placeholder-taupe-light outline-none"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isTyping}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-150 ${
              input.trim() && !isTyping ? 'bg-charcoal text-ivory-light' : 'bg-border text-taupe-light'
            }`}
          >
            <SendIcon />
          </button>
        </div>
      </div>

      {/* Explanation panel overlay */}
      {showExplanation && (
        <div
          className="absolute inset-0 bg-charcoal/40 z-40 flex items-end"
          onClick={() => setShowExplanation(false)}
        >
          <div
            className="w-full bg-ivory-light rounded-t-3xl p-6 pb-8 max-h-[75%] overflow-y-auto shadow-[0_-8px_40px_rgba(0,0,0,0.12)]"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-border rounded-full mx-auto mb-6" />
            <span className="text-gold text-[10px] tracking-[0.2em] uppercase font-medium">What they mean</span>

            <div className="mt-4 space-y-3">
              {explanationPhrases.map(({ phrase, meaning }) => (
                <div key={phrase} className="bg-ivory rounded-2xl p-4 border border-border">
                  <div className="text-charcoal text-[13px] font-medium">{phrase}</div>
                  <div className="text-taupe text-[13px] font-light mt-0.5">{meaning}</div>
                </div>
              ))}
            </div>

            <div className="mt-6">
              <span className="text-charcoal text-[13px] font-medium">You could reply:</span>
              <div className="mt-3 space-y-2">
                {explanationReplies.map(({ text, tone }) => (
                  <button
                    key={text}
                    onClick={() => {
                      setInput(text);
                      setShowExplanation(false);
                    }}
                    className="w-full bg-gold-pale rounded-xl p-3 flex items-center justify-between active:scale-[0.98] transition-all"
                  >
                    <span className="text-charcoal text-[13px] font-medium text-left">"{text}"</span>
                    <span className="text-taupe text-[11px] font-light ml-3 flex-shrink-0">{tone}</span>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setShowExplanation(false)}
              className="w-full mt-6 bg-charcoal text-ivory-light rounded-2xl py-3.5 text-sm font-medium active:scale-[0.98] transition-all"
            >
              Got it 👍
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Screen: Learn (Library + Lookup tabs) ──────────────────────────────────
function LearnScreen() {
  const [tab, setTab] = useState<LearnTab>('library');
  const [activeCategory, setActiveCategory] = useState<LibraryCategory>('EVERYDAY');
  const [lookupInput, setLookupInput] = useState('');
  const [lookupResult, setLookupResult] = useState<(typeof LOOKUP_DATA)[string] | null>(null);
  const [lookupTerm, setLookupTerm] = useState('');

  const doLookup = (term: string) => {
    const key = term.toLowerCase().trim();
    setLookupTerm(term);
    setLookupResult(LOOKUP_DATA[key] ?? null);
    setLookupInput(term);
  };

  const categories: LibraryCategory[] = ['EVERYDAY', 'REACTIONS', 'SLANG', 'EMOTIONAL', 'INTERNET'];

  return (
    <div className="flex flex-col h-full bg-ivory">
      {/* Fixed header */}
      <div className="px-5 pt-14 pb-0 flex-shrink-0">
        <h1 className="font-serif text-charcoal text-[1.8rem] font-normal italic mb-4 leading-tight">
          The stuff your<br />textbook forgot.
        </h1>
        <div className="flex gap-1 bg-champagne rounded-xl p-1 mb-0">
          {(['library', 'lookup'] as LearnTab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 rounded-lg text-xs font-medium transition-all duration-150 ${
                tab === t ? 'bg-charcoal text-ivory-light' : 'text-taupe'
              }`}
            >
              {t === 'library' ? 'Slang Library' : 'What does this mean?'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'library' ? (
        <div className="flex-1 overflow-y-auto pb-4">
          {/* Category pills */}
          <div className="flex gap-2 px-5 py-4 overflow-x-auto flex-shrink-0">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-1.5 rounded-full text-[11px] font-medium whitespace-nowrap flex-shrink-0 border transition-all duration-150 active:scale-95 ${
                  activeCategory === cat
                    ? 'bg-charcoal text-ivory-light border-charcoal'
                    : 'bg-transparent text-taupe border-border hover:border-taupe'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Cards */}
          <div className="px-5 space-y-3">
            {LIBRARY_DATA[activeCategory].map(({ term, definition, example }) => (
              <div key={term} className="bg-ivory-light rounded-2xl p-5 border border-border">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <span className="font-serif text-charcoal text-xl font-normal">{term}</span>
                  <span className="text-taupe text-[11px] font-light bg-champagne px-2.5 py-0.5 rounded-full flex-shrink-0">{definition}</span>
                </div>
                <p className="text-taupe text-xs font-light leading-relaxed italic">{example}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-5 pt-4 pb-4">
          <div className="relative mb-4">
            <input
              value={lookupInput}
              onChange={e => {
                setLookupInput(e.target.value);
                if (!e.target.value) { setLookupResult(null); setLookupTerm(''); }
              }}
              onKeyDown={e => e.key === 'Enter' && doLookup(lookupInput)}
              placeholder="Type something you don't understand..."
              className="w-full bg-ivory-light border border-border rounded-2xl px-5 py-4 text-sm text-charcoal placeholder-taupe-light outline-none focus:border-taupe transition-colors"
            />
          </div>

          {!lookupResult && (
            <>
              <p className="text-taupe-light text-xs mb-3">try these:</p>
              <div className="flex flex-wrap gap-2 mb-6">
                {['lowkey', 'wyd', 'bet', 'cooked', 'no cap', 'ate'].map(term => (
                  <button
                    key={term}
                    onClick={() => doLookup(term)}
                    className="px-4 py-2 bg-ivory-light border border-border rounded-full text-sm text-taupe font-medium hover:border-gold hover:text-gold transition-all active:scale-95"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </>
          )}

          {lookupResult && (
            <div className="bg-ivory-light rounded-3xl border border-border p-6">
              <span className="font-serif text-charcoal text-[2.6rem] font-normal leading-none">{lookupTerm}</span>
              <div className="text-taupe-light text-xs mt-1 mb-5 font-mono">{lookupResult.pronunciation}</div>

              <div className="mb-5">
                <span className="text-gold text-[10px] tracking-[0.2em] uppercase font-medium">Basically means</span>
                <p className="text-charcoal text-[14px] mt-1.5 leading-relaxed">{lookupResult.meaning}</p>
              </div>

              <div className="space-y-2 mb-5">
                {lookupResult.examples.map((ex, i) => (
                  <div key={i} className="bg-ivory rounded-xl px-4 py-3 text-[12px] text-taupe font-light leading-relaxed italic border border-border">
                    {ex}
                  </div>
                ))}
              </div>

              <div className="mb-5">
                <span className="text-gold text-[10px] tracking-[0.2em] uppercase font-medium">How it feels</span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {lookupResult.vibes.map(v => (
                    <span key={v} className="text-[11px] text-taupe bg-champagne rounded-full px-3 py-1">{v}</span>
                  ))}
                </div>
              </div>

              <div className="bg-charcoal rounded-2xl p-4">
                <span className="text-gold text-[10px] tracking-[0.2em] uppercase font-medium">Try saying</span>
                <p className="text-ivory-light text-[14px] mt-1.5 font-serif italic font-light">"{lookupResult.practice}"</p>
              </div>

              <button
                onClick={() => { setLookupResult(null); setLookupInput(''); setLookupTerm(''); }}
                className="w-full mt-4 border border-border rounded-xl py-2.5 text-taupe text-xs font-medium hover:border-taupe transition-colors"
              >
                Search another →
              </button>
            </div>
          )}

          {lookupInput && !lookupResult && (
            <div className="text-center py-10">
              <p className="text-taupe text-sm font-light">hmm, don't have that one yet 😭</p>
              <p className="text-taupe-light text-xs mt-1">try: lowkey, wyd, bet, cooked, no cap</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Screen: Saved ──────────────────────────────────────────────────────────
function SavedScreen() {
  const [activeSection, setActiveSection] = useState(0);

  return (
    <div className="flex flex-col h-full bg-ivory">
      <div className="px-5 pt-14 pb-4 flex-shrink-0">
        <h1 className="font-serif text-charcoal text-[1.9rem] font-normal italic leading-tight mb-1">
          Your little language vault.
        </h1>
        <p className="text-taupe text-sm font-light mb-5">47 phrases saved</p>

        {/* Section tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {SAVED_SECTIONS.map((section, i) => (
            <button
              key={i}
              onClick={() => setActiveSection(i)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0 border transition-all active:scale-95 ${
                activeSection === i
                  ? 'bg-charcoal text-ivory-light border-charcoal'
                  : 'border-border text-taupe hover:border-taupe'
              }`}
            >
              <span>{section.icon}</span>
              {section.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-4">
        <div className="space-y-3">
          {SAVED_SECTIONS[activeSection].phrases.map((phrase, i) => (
            <div key={i} className="bg-ivory-light rounded-2xl p-5 border border-border flex items-center justify-between">
              <span className="font-serif text-charcoal text-[1.2rem] font-normal">{phrase}</span>
              <button className="text-taupe-light hover:text-gold transition-colors ml-3 flex-shrink-0">
                <HeartIcon />
              </button>
            </div>
          ))}

          {/* Empty-state add prompt */}
          <div className="bg-champagne rounded-2xl p-5 border border-dashed border-gold/30 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full border border-gold flex items-center justify-center text-gold text-base flex-shrink-0">+</div>
            <span className="text-taupe text-sm font-light">Save phrases from your conversations</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Notifications toggle row ─────────────────────────────────────────────
function NotificationSettingsRow() {
  const [status, setStatus] = useState<PushStatus | 'loading'>('loading');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getPushStatus().then(setStatus).catch(() => setStatus('unsupported'));
  }, []);

  const handleClick = async () => {
    setError('');
    if (status === 'subscribed') {
      setBusy(true);
      try {
        await unsubscribeFromPush();
        setStatus('not-subscribed');
      } catch {
        setError("couldn't turn off notifications, try again");
      } finally {
        setBusy(false);
      }
      return;
    }

    if (status === 'not-subscribed') {
      setBusy(true);
      try {
        await subscribeToPush();
        setStatus('subscribed');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'something went wrong');
      } finally {
        setBusy(false);
      }
    }
  };

  const label =
    status === 'loading'
      ? 'Notification Settings'
      : status === 'unsupported'
      ? 'Notifications not supported here'
      : status === 'needs-install'
      ? 'Add to Home Screen to enable'
      : status === 'denied'
      ? 'Notifications blocked (check phone settings)'
      : status === 'subscribed'
      ? 'Notifications: On'
      : 'Notifications: Off';

  const clickable = status === 'subscribed' || status === 'not-subscribed';

  return (
    <div>
      <button
        onClick={clickable ? handleClick : undefined}
        disabled={!clickable || busy}
        className="w-full flex items-center justify-between bg-ivory-light rounded-2xl px-5 py-4 border border-border hover:border-taupe active:scale-[0.98] transition-all disabled:opacity-60"
      >
        <span className="text-charcoal text-sm font-medium">{label}</span>
        {clickable ? (
          <div className={`w-10 h-6 rounded-full flex items-center px-0.5 transition-colors ${status === 'subscribed' ? 'bg-gold justify-end' : 'bg-border justify-start'}`}>
            <div className="w-5 h-5 rounded-full bg-white shadow" />
          </div>
        ) : (
          <ChevronRight />
        )}
      </button>
      {error && <p className="text-red-500 text-xs mt-1 px-1">{error}</p>}
    </div>
  );
}

// ── Screen: Profile ────────────────────────────────────────────────────────
function ProfileScreen() {
  return (
    <div className="h-full overflow-y-auto bg-ivory">
      <div className="px-5 pt-14 pb-6">
        {/* Avatar */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 rounded-full bg-charcoal flex items-center justify-center text-gold font-serif text-3xl font-normal mb-3 shadow-[0_4px_20px_rgba(26,23,20,0.15)]">
            M
          </div>
          <h1 className="font-serif text-charcoal text-2xl font-normal">Maya</h1>
          <p className="text-taupe text-xs font-light italic mt-1">"Learning to sound more like myself."</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[{ n: '127', l: 'words' }, { n: '63', l: 'phrases' }, { n: '41', l: 'slang' }].map(({ n, l }) => (
            <div key={l} className="bg-ivory-light rounded-2xl p-4 text-center border border-border">
              <div className="font-serif text-charcoal text-2xl font-normal">{n}</div>
              <div className="text-taupe text-[11px] font-light mt-0.5">{l}</div>
            </div>
          ))}
        </div>

        {/* Confidence bar */}
        <div className="bg-champagne rounded-2xl p-4 mb-3 flex items-center justify-between border border-border">
          <div>
            <div className="text-taupe text-xs mb-0.5">Confidence</div>
            <div className="text-charcoal text-sm font-medium">Growing ↑</div>
          </div>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className={`w-6 h-1.5 rounded-full ${i <= 3 ? 'bg-gold' : 'bg-border'}`} />
            ))}
          </div>
        </div>

        {/* Attribute cards */}
        {[
          { label: 'My learning style', tags: ['Casual', 'Funny', 'Emotional'] },
          { label: 'Topics I like',     tags: ['Friends', 'Movies', 'Internet', 'Life'] },
        ].map(({ label, tags }) => (
          <div key={label} className="bg-ivory-light rounded-2xl p-5 border border-border mb-3">
            <span className="text-taupe text-[10px] uppercase tracking-widest">{label}</span>
            <div className="flex flex-wrap gap-2 mt-2">
              {tags.map(t => (
                <span key={t} className="text-charcoal text-xs font-medium bg-gold-pale px-3 py-1 rounded-full">{t}</span>
              ))}
            </div>
          </div>
        ))}

        <div className="bg-ivory-light rounded-2xl p-5 border border-border mb-5 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-charcoal flex items-center justify-center text-gold text-sm font-serif flex-shrink-0">N</div>
          <div>
            <span className="text-taupe text-[10px] uppercase tracking-widest">AI Personality</span>
            <div className="text-charcoal text-sm font-medium">Gen-Z Bestie</div>
          </div>
        </div>

        {/* Settings */}
        <div className="space-y-2">
          <NotificationSettingsRow />
          {['Language Preferences', 'Privacy', 'Help & Support'].map(item => (
            <button key={item} className="w-full flex items-center justify-between bg-ivory-light rounded-2xl px-5 py-4 border border-border hover:border-taupe active:scale-[0.98] transition-all">
              <span className="text-charcoal text-sm font-medium">{item}</span>
              <ChevronRight />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Root ───────────────────────────────────────────────────────────────────
export default function App() {
  const [phase, setPhase] = useState<AppPhase>('onboarding');
  const [screen, setScreen] = useState<MainScreen>('home');

  // Onboarding phases share the same full-screen container
  if (phase !== 'main') {
    return (
      <div className="h-full flex justify-center bg-[#EDE7DA]">
        <div className="w-full max-w-[430px] h-full">
          {phase === 'onboarding' && <WelcomeScreen onNext={() => setPhase('personalization')} />}
          {phase === 'personalization' && <PersonalizationScreen onNext={() => setPhase('main')} />}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex justify-center bg-[#EDE7DA]">
      <div className="w-full max-w-[430px] h-full flex flex-col bg-ivory overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.12)]">
        {/* Screen content */}
        <div className="flex-1 overflow-hidden relative">
          {screen === 'home'    && <HomeScreen    onNavigate={setScreen} />}
          {screen === 'chat'    && <ChatScreen    />}
          {screen === 'learn'   && <LearnScreen   />}
          {screen === 'saved'   && <SavedScreen   />}
          {screen === 'profile' && <ProfileScreen />}
        </div>

        {/* Bottom nav */}
        <BottomNav current={screen} onNavigate={setScreen} />
      </div>
    </div>
  );
}
