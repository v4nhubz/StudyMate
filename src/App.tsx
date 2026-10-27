import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { api, auth } from '@appdeploy/client';
import QuizGame from './QuizGame';
import ChessGame from './ChessGame';
import {
  ArrowRight,
  Brain,
  Check,
  ChevronRight,
  Circle,
  Clock3,
  Menu,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  UserRound,
  BookOpen,
  Gamepad2,
  X,
  BookMarked,
  Heart,
  Search,
} from 'lucide-react';

type Task = { id: number; title: string; deadline: string; done: boolean };
type Problem = {
  subject: string;
  number: number;
  problem: string;
  hint: string;
  approach: string;
  answer: string;
  keyIdeas: string[];
};
type GradeResult = {
  score: number;
  strengths: string[];
  message: string;
};

const dailyVerses = [
{reference:'Psalm 118:24',text:'This is the day which the LORD hath made; we will rejoice and be glad in it.'},
{reference:'Proverbs 3:5',text:'Trust in the LORD with all thine heart; and lean not unto thine own understanding.'},
{reference:'Philippians 4:13',text:'I can do all things through Christ which strengtheneth me.'},
{reference:'Joshua 1:9',text:'Be strong and of a good courage; be not afraid, neither be thou dismayed: for the LORD thy God is with thee whithersoever thou goest.'},
{reference:'Psalm 23:1',text:'The LORD is my shepherd; I shall not want.'},
{reference:'Matthew 5:16',text:'Let your light so shine before men, that they may see your good works, and glorify your Father which is in heaven.'},
{reference:'Isaiah 41:10',text:'Fear thou not; for I am with thee: be not dismayed; for I am thy God: I will strengthen thee; yea, I will help thee.'},
{reference:'Romans 12:12',text:'Rejoicing in hope; patient in tribulation; continuing instant in prayer.'},
{reference:'Psalm 46:10',text:'Be still, and know that I am God.'},
{reference:'Galatians 6:9',text:'And let us not be weary in well doing: for in due season we shall reap, if we faint not.'},
{reference:'Proverbs 16:3',text:'Commit thy works unto the LORD, and thy thoughts shall be established.'},
{reference:'Psalm 119:105',text:'Thy word is a lamp unto my feet, and a light unto my path.'},
{reference:'James 1:5',text:'If any of you lack wisdom, let him ask of God, that giveth to all men liberally; and it shall be given him.'},
{reference:'Colossians 3:23',text:'And whatsoever ye do, do it heartily, as to the Lord, and not unto men.'},
{reference:'John 14:27',text:'Peace I leave with you, my peace I give unto you: not as the world giveth, give I unto you.'},
{reference:'Matthew 11:28',text:'Come unto me, all ye that labour and are heavy laden, and I will give you rest.'},
{reference:'1 Peter 5:7',text:'Casting all your care upon him; for he careth for you.'},
{reference:'2 Timothy 1:7',text:'For God hath not given us the spirit of fear; but of power, and of love, and of a sound mind.'}
];
function dailyBibleVerse(now:Date){const reset=new Date(now);reset.setHours(6,0,0,0);if(now<reset)reset.setDate(reset.getDate()-1);const day=Math.floor(new Date(reset.getFullYear(),reset.getMonth(),reset.getDate()).getTime()/86400000);return dailyVerses[((day%dailyVerses.length)+dailyVerses.length)%dailyVerses.length];}
const bibleBooks=['Genesis','Exodus','Leviticus','Numbers','Deuteronomy','Joshua','Judges','Ruth','1 Samuel','2 Samuel','1 Kings','2 Kings','1 Chronicles','2 Chronicles','Ezra','Nehemiah','Esther','Job','Psalms','Proverbs','Ecclesiastes','Song of Solomon','Isaiah','Jeremiah','Lamentations','Ezekiel','Daniel','Hosea','Joel','Amos','Obadiah','Jonah','Micah','Nahum','Habakkuk','Zephaniah','Haggai','Zechariah','Malachi','Matthew','Mark','Luke','John','Acts','Romans','1 Corinthians','2 Corinthians','Galatians','Ephesians','Philippians','Colossians','1 Thessalonians','2 Thessalonians','1 Timothy','2 Timothy','Titus','Philemon','Hebrews','James','1 Peter','2 Peter','1 John','2 John','3 John','Jude','Revelation'];
const bibleChapterCounts:Record<string,number>={Genesis:50,Exodus:40,Leviticus:27,Numbers:36,Deuteronomy:34,Joshua:24,Judges:21,Ruth:4,'1 Samuel':31,'2 Samuel':24,'1 Kings':22,'2 Kings':25,'1 Chronicles':29,'2 Chronicles':36,Ezra:10,Nehemiah:13,Esther:10,Job:42,Psalms:150,Proverbs:31,Ecclesiastes:12,'Song of Solomon':8,Isaiah:66,Jeremiah:52,Lamentations:5,Ezekiel:48,Daniel:12,Hosea:14,Joel:3,Amos:9,Obadiah:1,Jonah:4,Micah:7,Nahum:3,Habakkuk:3,Zephaniah:3,Haggai:2,Zechariah:14,Malachi:4,Matthew:28,Mark:16,Luke:24,John:21,Acts:28,Romans:16,'1 Corinthians':16,'2 Corinthians':13,Galatians:6,Ephesians:6,Philippians:4,Colossians:4,'1 Thessalonians':5,'2 Thessalonians':3,'1 Timothy':6,'2 Timothy':4,Titus:3,Philemon:1,Hebrews:13,James:5,'1 Peter':5,'2 Peter':3,'1 John':5,'2 John':1,'3 John':1,Jude:1,Revelation:22};

const welcomeWords = ['Student', 'Learner', 'Scholar', 'STEM thinker', 'Future achiever'];

const exampleTasks = [
  { title: 'Mathematics Activity', days: 1 },
  { title: 'Science Research Notes', days: 2 },
  { title: 'English Reading Assignment', days: 3 },
  { title: 'Research Chapter 1', days: 4 },
  { title: 'STEM Problem Set', days: 5 },
  { title: 'History Reviewer', days: 6 },
];

const practiceProblems: Problem[] = [
  {
    subject: 'BUDGET REASONING',
    number: 1,
    problem: 'Your class has ₱1,200 for a small school activity. You spend ₱350 on materials, ₱85 each for 3 prizes, and ₱160 for transportation. You also want to keep at least ₱300 unused. Can you stay within that limit, and how much will remain?',
    hint: 'Find the total spent first, then compare what remains with the ₱300 you want to keep.',
    approach: 'Materials cost ₱350 and the prizes cost 3 × ₱85 = ₱255. Add transportation: ₱350 + ₱255 + ₱160 = ₱765. The amount left is ₱1,200 − ₱765 = ₱435, so ₱135 more than the ₱300 target remains.',
    answer: '435',
    keyIdeas: ['added all three expenses', 'subtracted total spending from 1200', 'compared 435 with 300'],
  },
  {
    subject: 'EVERYDAY REASONING',
    number: 2,
    problem: 'A water container holds 5 liters. In the morning, 8 bottles of 600 mL each are filled from it. Later, another 700 mL is used. Without refilling the container, how much water is left?',
    hint: 'Convert everything to the same unit before subtracting.',
    approach: 'The 8 bottles use 8 × 600 mL = 4,800 mL. The later use makes 5,500 mL used in total, which is more than the 5,000 mL container holds. Therefore, the situation is impossible without a refill: 500 mL is missing.',
    answer: 'impossible',
    keyIdeas: ['converted 5 liters to 5000 ml', 'calculated 4800 ml plus 700 ml', 'noticed total use exceeds the container'],
  },
  {
    subject: 'TIME MANAGEMENT',
    number: 3,
    problem: 'You start studying at 6:40 PM. You spend 45 minutes on Math, 20 minutes reviewing notes, take a 10-minute break, and then spend 35 minutes on Science. What time should you finish?',
    hint: 'Add every time period, including the break.',
    approach: '45 + 20 + 10 + 35 = 110 minutes, which is 1 hour 50 minutes. Starting at 6:40 PM gives a finish time of 8:30 PM.',
    answer: '8:30 pm',
    keyIdeas: ['added all four time periods', 'converted 110 minutes to 1 hour 50 minutes', 'started from 6:40 pm'],
  },
  {
    subject: 'STATISTICS',
    number: 4,
    problem: 'Four quiz scores have an average of 85. Three scores are 78, 84, and 91. What must the fourth score be?',
    hint: 'Work backward from the total score required by the average.',
    approach: 'An average of 85 for four scores means a total of 85 × 4 = 340. The known scores total 78 + 84 + 91 = 253. The missing score is 340 − 253 = 87.',
    answer: '87',
    keyIdeas: ['found the required total of 340', 'added the three known scores', 'subtracted 253 from 340'],
  },
  {
    subject: 'SHOPPING REASONING',
    number: 5,
    problem: 'A calculator is marked ₱900. A store gives a 15% discount, then adds 8% tax to the discounted price. What is the final price?',
    hint: 'Do not apply the tax to the original price. Discount first.',
    approach: 'A 15% discount is ₱135, so the discounted price is ₱765. Eight percent of ₱765 is ₱61.20. The final price is ₱826.20.',
    answer: '826.20',
    keyIdeas: ['found the 15 percent discount', 'used 765 as the tax base', 'added 61.20 tax'],
  },
  {
    subject: 'PHYSICS REASONING',
    number: 6,
    problem: 'A bus travels 150 km on a trip. The whole trip takes 3 hours, but the bus is stopped for 30 minutes. What is its average speed while it is actually moving?',
    hint: 'The 30-minute stop should not be included in moving time.',
    approach: 'Three hours minus 30 minutes is 2.5 hours of moving time. Average speed is 150 ÷ 2.5 = 60 km/h.',
    answer: '60 km/h',
    keyIdeas: ['removed the 30 minute stop', 'used 2.5 hours of moving time', 'divided 150 by 2.5'],
  },
  {
    subject: 'CHEMISTRY REASONING',
    number: 7,
    problem: 'In a closed container, two substances have masses of 12 g and 8 g before reacting. After the reaction, no material leaves the container. What should the total mass be after the reaction?',
    hint: 'The container is closed, so mass is not lost from the system.',
    approach: 'Add the two starting masses: 12 g + 8 g = 20 g. Because the container is closed, the total mass remains 20 g.',
    answer: '20 g',
    keyIdeas: ['added 12 and 8', 'used conservation of mass', 'kept the system closed'],
  },
  {
    subject: 'GEOMETRY REASONING',
    number: 8,
    problem: 'A rectangular garden is 30 m by 18 m. A fence will go around the entire edge except for a 4 m opening for a gate. How many meters of fence are needed?',
    hint: 'Find the full perimeter first, then remove the gate opening.',
    approach: 'The perimeter is 2(30 + 18) = 96 m. The 4 m gate does not need fencing, so 96 − 4 = 92 m.',
    answer: '92 m',
    keyIdeas: ['found the full perimeter', 'subtracted the 4 meter opening'],
  },
  {
    subject: 'LOGIC',
    number: 9,
    problem: 'Three students each make one claim about a missing notebook. Ana says, “Ben took it.” Ben says, “Carla took it.” Carla says, “Ben is lying.” Exactly one statement is true. Who took the notebook?',
    hint: 'Test each possible person and count how many statements become true.',
    approach: 'If Ben took it, Ana is true, Ben is false, and Carla is true, giving two truths. If Carla took it, Ana is false, Ben is true, and Carla is false, giving exactly one truth. Therefore Carla took it.',
    answer: 'Carla',
    keyIdeas: ['tested the possible people', 'counted true statements', 'found only Carla gives one true statement'],
  },
  {
    subject: 'RATIO REASONING',
    number: 10,
    problem: 'A class mixes red and blue paper in a 2:3 ratio. They already have 8 red sheets and want to keep the same ratio after adding more paper. How many blue sheets must they add?',
    hint: 'First determine how many red sheets correspond to 8 in the 2:3 ratio.',
    approach: 'The 2-part red amount became 8, so each ratio part is 4. Blue has 3 parts, so the matching blue amount is 3 × 4 = 12 sheets.',
    answer: '12',
    keyIdeas: ['found 4 per ratio part', 'used 3 blue parts', 'got 12 blue sheets'],
  },
  {
    subject: 'ALGEBRA REASONING',
    number: 11,
    problem: 'A school club charges ₱40 to join plus ₱15 for each meeting attended. A student paid ₱130 in total. How many meetings did the student attend?',
    hint: 'Remove the fixed joining fee before dealing with the per-meeting cost.',
    approach: 'Subtract the ₱40 joining fee from ₱130, leaving ₱90. Divide ₱90 by ₱15 per meeting to get 6 meetings.',
    answer: '6',
    keyIdeas: ['removed the fixed fee', 'divided the remaining 90 by 15'],
  },
  {
    subject: 'DECIMAL REASONING',
    number: 12,
    problem: 'You have ₱500. You spend ₱126.75, then receive ₱80 from a friend for an item you bought for them. You later spend ₱45.50. How much do you have now?',
    hint: 'Treat the money received as an addition, not a subtraction.',
    approach: 'Start with ₱500 − ₱126.75 = ₱373.25. Add ₱80 to get ₱453.25. Then subtract ₱45.50, leaving ₱407.75.',
    answer: '407.75',
    keyIdeas: ['subtracted the first expense', 'added the 80 received', 'subtracted the later expense'],
  },
  {
    subject: 'PROBABILITY REASONING',
    number: 13,
    problem: 'A box contains 4 red, 3 blue, and 3 green cards. You pick one card without looking. Is picking a red card more likely than picking a blue or green card combined? Explain with the probability.',
    hint: 'Compare the number of red cards with the number of non-red cards.',
    approach: 'There are 10 cards total. Red has probability 4/10, while blue or green combined has 6/10. So red is not more likely; blue or green combined is more likely.',
    answer: 'no',
    keyIdeas: ['counted 10 total cards', 'red is 4 out of 10', 'blue or green is 6 out of 10'],
  },
  {
    subject: 'SCIENCE REASONING',
    number: 14,
    problem: 'Two identical cups contain the same amount of water. One is placed in sunlight and one in a shaded room. After several hours, which cup should have less water, and what process best explains the difference?',
    hint: 'Think about what heat and moving air can do to water at the surface.',
    approach: 'The cup in sunlight should generally have less water because more heat can increase evaporation from the water surface. The process is evaporation.',
    answer: 'sunlight cup; evaporation',
    keyIdeas: ['chose the sunlight cup', 'identified evaporation', 'connected heat with faster evaporation'],
  },
  {
    subject: 'MULTI-STEP GEOMETRY',
    number: 15,
    problem: 'A 10 m by 6 m rectangular floor is covered with square tiles. Each tile covers 0.5 m². How many tiles are needed if none are wasted?',
    hint: 'Find the floor area before dividing by the area of one tile.',
    approach: 'The floor area is 10 × 6 = 60 m². Divide 60 by 0.5 m² per tile to get 120 tiles.',
    answer: '120',
    keyIdeas: ['found 60 square meters', 'divided by 0.5 square meters per tile'],
  },
  {
    subject: 'AVERAGE REASONING',
    number: 16,
    problem: 'A student wants an average of at least 90 on four tests. The first three scores are 86, 92, and 88. What is the lowest score needed on the fourth test?',
    hint: 'Find the minimum total needed for an average of 90.',
    approach: 'Four tests need a total of at least 360. The first three total 266. The fourth score must therefore be at least 94.',
    answer: '94',
    keyIdeas: ['found the minimum total of 360', 'added the first three scores', 'found 94 as the minimum'],
  },
  {
    subject: 'TIME AND CHOICE',
    number: 17,
    problem: 'You have 70 minutes before leaving for school. Getting ready takes 25 minutes and packing takes 10 minutes. You want to spend the rest studying, but you also need a 5-minute buffer. How many minutes can you study?',
    hint: 'Reserve the getting-ready time, packing time, and buffer before calculating study time.',
    approach: '70 − 25 − 10 − 5 = 30 minutes available for studying.',
    answer: '30 minutes',
    keyIdeas: ['reserved 25 minutes', 'reserved 10 minutes and 5 minute buffer', 'found 30 minutes left'],
  },
  {
    subject: 'PATTERN REASONING',
    number: 18,
    problem: 'A sequence follows a pattern: 4, 7, 13, 25, 49, ?. The amount added doubles each time. What number comes next?',
    hint: 'Look at the differences between consecutive numbers.',
    approach: 'The differences are +3, +6, +12, and +24. The next difference is +48, so 49 + 48 = 97.',
    answer: '97',
    keyIdeas: ['found differences 3, 6, 12, 24', 'doubled the difference', 'added 48 to 49'],
  },
  {
    subject: 'DATA REASONING',
    number: 19,
    problem: 'A teacher records study times of 20 students. The total study time is 300 minutes. Ten students studied 10 minutes each, while the other ten students studied the same amount of time. How many minutes did each of the other ten students study?',
    hint: 'Find how much time the first ten students used, then divide what remains among the other ten.',
    approach: 'The first ten used 10 × 10 = 100 minutes. That leaves 200 minutes. Divide 200 by the remaining 10 students to get 20 minutes each.',
    answer: '20 minutes',
    keyIdeas: ['found 100 minutes for the first ten', 'found 200 minutes remaining', 'divided by 10 students'],
  },
  {
    subject: 'REAL-LIFE REASONING',
    number: 20,
    problem: 'You have 2 hours for three tasks. Task A needs 35 minutes, Task B needs 50 minutes, and Task C needs 45 minutes. You must also leave 10 minutes for checking your work. Is 2 hours enough? If not, how many minutes are you short?',
    hint: 'Add all task times and the checking time, then compare the result with 120 minutes.',
    approach: 'The three tasks take 35 + 50 + 45 = 130 minutes. Adding 10 minutes for checking gives 140 minutes. Two hours is 120 minutes, so you are 20 minutes short.',
    answer: '20 minutes short',
    keyIdeas: ['added all three task times', 'included the 10 minute checking time', 'compared 140 with 120'],
  },
];

function buildGeneratedSet(setNumber: number, weakSubjects: string[]) {
  const frames = [
    'A new school scenario: ',
    'A fresh real-life situation: ',
    'A classmate gives you this challenge: ',
    'For a different practice situation: ',
  ];
  const weak = new Set(weakSubjects);
  const ordered = [...practiceProblems].sort((a, b) => Number(weak.has(b.subject)) - Number(weak.has(a.subject)));
  const selected = [...ordered];
  const weakTemplates = ordered.filter(item => weak.has(item.subject));
  if (weakTemplates.length) {
    for (let i = 0; i < Math.min(4, weakTemplates.length); i += 1) selected[practiceProblems.length - 1 - i] = weakTemplates[i];
  }
  return selected.map((base, index) => {
    const frame = frames[(setNumber + index) % frames.length];
    const targeted = weak.has(base.subject);
    return {
      ...base,
      number: index + 1,
      problem: `${frame}${base.problem} ${targeted ? 'This one targets a skill you need more practice with, so show the reasoning you used.' : 'Show the reasoning you used, not only the final answer.'}`,
      hint: `${base.hint} ${targeted ? 'Focus especially on this skill.' : ''}`.trim(),
    };
  });
}

function shuffleProblemIndexes(previous: number[] = []) {
  const indexes = practiceProblems.map((_, index) => index);
  let shuffled = [...indexes];
  let attempts = 0;
  do {
    shuffled = [...indexes];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    attempts += 1;
  } while (previous.length === shuffled.length && previous.every((value, index) => value === shuffled[index]) && attempts < 5);
  return shuffled;
}

function formatDate(value: string) {
  if (!value) return 'No deadline';
  return new Date(value + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getToday() {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Manila',
  }).format(new Date());
}

function getTime() {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Manila',
  }).format(new Date());
}

function datePlusDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function normalizeAnswer(value: string) {
  return value.toLowerCase().replace(/₱/g, '').replace(/,/g, '').replace(/\s+/g, ' ').trim();
}

function gradeProblem(problem: Problem, answer: string): GradeResult {
  const normalized = normalizeAnswer(answer);
  if (!normalized) {
    return { score: 0, strengths: [], message: 'No answer yet. Try the problem first, then submit your work.' };
  }

  const expected = normalizeAnswer(problem.answer);
  const numberMatch = normalized.includes(expected) || expected.includes(normalized);
  const strengths = problem.keyIdeas.filter(idea => {
    const words = idea.split(' ');
    return words.filter(word => word.length > 2 && normalized.includes(word)).length >= Math.max(1, Math.ceil(words.length * 0.45));
  });

  if (numberMatch) {
    return {
      score: 100,
      strengths: ['You reached the correct final answer.', ...strengths],
      message: 'Excellent work. Your final answer matches the expected answer.',
    };
  }

  if (strengths.length >= 2) {
    return {
      score: 80,
      strengths,
      message: 'You showed several correct ideas. Check the final calculation and try once more.',
    };
  }

  if (strengths.length === 1) {
    return {
      score: 60,
      strengths,
      message: 'You started with a useful idea. Review the next step in the suggested approach.',
    };
  }

  if (/\d/.test(normalized)) {
    return {
      score: 30,
      strengths: ['You attempted the problem instead of leaving it blank.'],
      message: 'You made an attempt. Compare your steps with the suggested approach and try again.',
    };
  }

  return {
    score: 10,
    strengths: ['You put an answer into the practice box.'],
    message: 'Your response needs another look. Use the hint and work through the steps.',
  };
}


type DictionaryEntry = { word: string; part: string; meaning: string; example: string };
type OnlineDictionaryEntry = {
  word: string;
  phonetic?: string;
  phonetics?: Array<{ text?: string; audio?: string }>;
  meanings: Array<{
    partOfSpeech: string;
    definitions: Array<{ definition: string; example?: string; synonyms?: string[]; antonyms?: string[] }>;
    synonyms?: string[];
    antonyms?: string[];
  }>;
};
const dictionaryEntries: DictionaryEntry[] = [
  { word: 'Ability', part: 'noun', meaning: 'The power or skill to do something.', example: 'Reading is an important ability.' },
  { word: 'Achieve', part: 'verb', meaning: 'To succeed in doing or reaching something.', example: 'She worked hard to achieve her goal.' },
  { word: 'Balance', part: 'noun', meaning: 'A state in which different things are kept equal or steady.', example: 'A good balance between study and rest is helpful.' },
  { word: 'Brave', part: 'adjective', meaning: 'Ready to face danger or difficulty without giving up.', example: 'He was brave enough to ask for help.' },
  { word: 'Calm', part: 'adjective', meaning: 'Peaceful and not worried or excited.', example: 'Take a calm breath before the test.' },
  { word: 'Curious', part: 'adjective', meaning: 'Wanting to learn or know more about something.', example: 'Curious students ask questions.' },
  { word: 'Decide', part: 'verb', meaning: 'To choose after thinking about the options.', example: 'I need to decide which topic to study first.' },
  { word: 'Describe', part: 'verb', meaning: 'To say or write what someone or something is like.', example: 'Describe the experiment in your notes.' },
  { word: 'Effort', part: 'noun', meaning: 'The energy used to do something.', example: 'Learning a new skill takes effort.' },
  { word: 'Encourage', part: 'verb', meaning: 'To give someone support or confidence.', example: 'Friends encourage each other.' },
  { word: 'Focus', part: 'verb', meaning: 'To give attention to one thing.', example: 'Focus on one question at a time.' },
  { word: 'Flexible', part: 'adjective', meaning: 'Able to change or adjust easily.', example: 'Be flexible when your schedule changes.' },
  { word: 'Goal', part: 'noun', meaning: 'Something a person wants to achieve.', example: 'My goal is to finish my project today.' },
  { word: 'Grateful', part: 'adjective', meaning: 'Feeling thankful for something.', example: 'I am grateful for my teacher’s advice.' },
  { word: 'Habit', part: 'noun', meaning: 'Something a person does regularly.', example: 'Reviewing notes can become a useful habit.' },
  { word: 'Honest', part: 'adjective', meaning: 'Truthful and not trying to mislead others.', example: 'Give an honest answer.' },
  { word: 'Improve', part: 'verb', meaning: 'To make or become better.', example: 'Practice can improve your writing.' },
  { word: 'Independent', part: 'adjective', meaning: 'Able to do things without always needing help.', example: 'She became more independent with her schoolwork.' },
  { word: 'Journey', part: 'noun', meaning: 'The act of travelling from one place to another; also a process of change or learning.', example: 'Learning is a journey.' },
  { word: 'Justice', part: 'noun', meaning: 'Fair treatment according to what is right.', example: 'The class discussed justice and fairness.' },
  { word: 'Kindness', part: 'noun', meaning: 'The quality of being friendly, caring, and helpful.', example: 'A small act of kindness can help someone.' },
  { word: 'Knowledge', part: 'noun', meaning: 'Information and understanding gained through learning or experience.', example: 'Books can increase your knowledge.' },
  { word: 'Learn', part: 'verb', meaning: 'To gain knowledge or a new skill.', example: 'We learn from practice and mistakes.' },
  { word: 'Logical', part: 'adjective', meaning: 'Based on clear reasoning and sensible ideas.', example: 'Use a logical order for your explanation.' },
  { word: 'Method', part: 'noun', meaning: 'A way of doing something.', example: 'Try a different method to solve the problem.' },
  { word: 'Motivate', part: 'verb', meaning: 'To give someone a reason or desire to act.', example: 'A clear goal can motivate you.' },
  { word: 'Notice', part: 'verb', meaning: 'To see, hear, or become aware of something.', example: 'Notice the pattern in the numbers.' },
  { word: 'Nurture', part: 'verb', meaning: 'To help a person, skill, or idea grow and develop.', example: 'Teachers nurture curiosity.' },
  { word: 'Observe', part: 'verb', meaning: 'To watch carefully in order to learn something.', example: 'Observe what happens during the experiment.' },
  { word: 'Organize', part: 'verb', meaning: 'To arrange things in a clear or useful order.', example: 'Organize your notes by subject.' },
  { word: 'Patient', part: 'adjective', meaning: 'Able to wait or continue without becoming upset.', example: 'Be patient while learning a difficult topic.' },
  { word: 'Persist', part: 'verb', meaning: 'To continue trying despite difficulty.', example: 'Persist when the first attempt does not work.' },
  { word: 'Question', part: 'noun', meaning: 'A sentence or request used to ask for information.', example: 'Write down each question you have.' },
  { word: 'Quiet', part: 'adjective', meaning: 'Making little or no noise.', example: 'A quiet place may help you study.' },
  { word: 'Respect', part: 'noun', meaning: 'Care and consideration for other people or things.', example: 'Show respect when others are speaking.' },
  { word: 'Reliable', part: 'adjective', meaning: 'Able to be trusted or depended on.', example: 'Use reliable sources for your research.' },
  { word: 'Solve', part: 'verb', meaning: 'To find an answer to a problem.', example: 'Solve the equation step by step.' },
  { word: 'Support', part: 'noun', meaning: 'Help or encouragement given to someone.', example: 'Ask for support when you need it.' },
  { word: 'Thoughtful', part: 'adjective', meaning: 'Showing careful thought or concern for others.', example: 'That was a thoughtful response.' },
  { word: 'Thrive', part: 'verb', meaning: 'To grow, develop, or do very well.', example: 'Students thrive when they feel supported.' },
  { word: 'Understand', part: 'verb', meaning: 'To know the meaning or reason for something.', example: 'Explain the idea in your own words to check that you understand it.' },
  { word: 'Useful', part: 'adjective', meaning: 'Helpful for a purpose.', example: 'A checklist is useful before an exam.' },
  { word: 'Value', part: 'noun', meaning: 'The importance or worth of something.', example: 'We value honesty and effort.' },
  { word: 'Visualize', part: 'verb', meaning: 'To form a picture or idea in your mind.', example: 'Visualize the steps before solving the problem.' },
  { word: 'Wise', part: 'adjective', meaning: 'Showing good judgment based on knowledge or experience.', example: 'It is wise to check your work.' },
  { word: 'Wonder', part: 'verb', meaning: 'To think about something with curiosity.', example: 'I wonder why the result changed.' },
  { word: 'eXamine', part: 'verb', meaning: 'To look at something carefully to understand or check it.', example: 'Examine the evidence before deciding.' },
  { word: 'eXample', part: 'noun', meaning: 'Something that shows what a thing is like or how it works.', example: 'The teacher gave an example.' },
  { word: 'Youth', part: 'noun', meaning: 'The period of life when someone is young.', example: 'Youth can be a time for learning and discovery.' },
  { word: 'Yearn', part: 'verb', meaning: 'To want something very much.', example: 'She yearns to learn new things.' },
  { word: 'Zeal', part: 'noun', meaning: 'Great energy and enthusiasm for something.', example: 'He studied with zeal.' },
  { word: 'Zenith', part: 'noun', meaning: 'The highest point or greatest level of something.', example: 'The team reached the zenith of its success.' }
];

const studyTips = [
  { category: 'Planning', title: 'Choose your top three tasks', detail: 'At the start of the day, list the three most important things to finish. Start with the task that is most urgent or needs the most effort.' },
  { category: 'Planning', title: 'Estimate time and add a buffer', detail: 'Guess how long each assignment will take, add a little extra time for unexpected delays, and avoid filling every minute of your schedule.' },
  { category: 'Planning', title: 'Break big assignments into steps', detail: 'Turn a large task into small actions, such as reading instructions, gathering sources, making an outline, drafting, and checking your work.' },
  { category: 'Problem Solving', title: 'Define what you know and what is missing', detail: 'Write down the goal, the facts you have, and the information you still need. Separate facts from assumptions before choosing a method.' },
  { category: 'Problem Solving', title: 'Try a simpler example first', detail: 'If the solution is unclear, use smaller numbers or an easier version of the situation. Look for a pattern, then apply it to the original problem.' },
  { category: 'Problem Solving', title: 'Draw it or organize the information', detail: 'Use a diagram, table, timeline, equation, or list to make relationships easier to see. Choose the format that best fits the problem.' },
  { category: 'Problem Solving', title: 'Test more than one approach', detail: 'Try a different strategy if the first one stalls. Check whether each result fits the facts and constraints instead of assuming the first answer is correct.' },
  { category: 'Problem Solving', title: 'Work backward and verify', detail: 'Start from the desired result when useful, reverse the steps, and then substitute your answer into the original problem to see if it makes sense.' },
  { category: 'Focus', title: 'Use a 25-minute focus session', detail: 'Choose one clear task, study for 25 minutes, then take a short break. Put unrelated notifications away.' },
  { category: 'Focus', title: 'Make distractions harder to reach', detail: 'Place your phone out of reach or turn on Do Not Disturb while you work.' },
  { category: 'Memory', title: 'Test yourself before rereading', detail: 'Close your notes and write what you remember. Then check what you missed.' },
  { category: 'Memory', title: 'Review a little across several days', detail: 'Short review sessions spread over time usually help more than one long last-minute session.' },
  { category: 'Notes', title: 'Write ideas in your own words', detail: 'After reading a section, explain the main point simply instead of copying every sentence.' },
  { category: 'Notes', title: 'Turn headings into questions', detail: 'Use each heading as a question and answer it from memory to make your notes active.' },
  { category: 'Planning', title: 'Pick the next small step', detail: 'Break a large assignment into actions you can finish, such as finding three sources or drafting one paragraph.' },
  { category: 'Planning', title: 'Sort tasks by deadline and effort', detail: 'Note what is due soon and what needs the most time. Start early on tasks that take longer.' },
  { category: 'Exams', title: 'Practice under realistic conditions', detail: 'Try sample questions without checking the answer immediately, then review your mistakes.' },
  { category: 'Exams', title: 'Sleep is part of preparation', detail: 'Keep a regular sleep routine before an exam so you can think clearly and remember what you studied.' },
  { category: 'Research', title: 'Keep track of your sources', detail: 'Save the author, title, date, and link while researching so you can cite the source later.' },
  { category: 'Research', title: 'Check claims against reliable sources', detail: 'Look for evidence, author expertise, publication date, and agreement with other trustworthy sources.' }
];

function App() {

  const [tasks, setTasks] = useState<Task[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('studymate_tasks') || '[]');
    } catch {
      return [];
    }
  });
  const [practiceResults, setPracticeResults] = useState<Record<number, GradeResult>>(() => {
    try {
      return JSON.parse(localStorage.getItem('studymate_practice_results') || '{}');
    } catch {
      return {};
    }
  });
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [currentProblems, setCurrentProblems] = useState<Problem[]>(() => buildGeneratedSet(1, []));
  const [weakSubjects, setWeakSubjects] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('studymate_weak_subjects') || '[]'); } catch { return []; }
  });
  const [completedSetReview, setCompletedSetReview] = useState<Array<{ problem: Problem; answer: string; grade: GradeResult }> | null>(() => {
    try { return JSON.parse(localStorage.getItem('studymate_completed_review') || 'null'); } catch { return null; }
  });
  const [showSetReview, setShowSetReview] = useState(() => localStorage.getItem('studymate_show_review') === 'true');
  const [title, setTitle] = useState('');
  const [deadline, setDeadline] = useState('');
  const [seconds, setSeconds] = useState(1500);
  const [running, setRunning] = useState(false);
  const [problemIndex, setProblemIndex] = useState(0);
  const [problemOrder, setProblemOrder] = useState<number[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('studymate_problem_order') || 'null');
      if (Array.isArray(saved) && saved.length === currentProblems.length && saved.every(value => Number.isInteger(value) && value >= 0 && value < currentProblems.length)) {
        return saved;
      }
    } catch {
      // Start a fresh random set when saved order is unavailable.
    }
    return shuffleProblemIndexes();
  });
  const [practiceSet, setPracticeSet] = useState(() => Number(localStorage.getItem('studymate_practice_set') || '1'));
  const [lastSetScore, setLastSetScore] = useState<number | null>(null);
  const [showApproach, setShowApproach] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [user, setUser] = useState<{ userId: string; name?: string; email?: string } | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [welcomeWordIndex, setWelcomeWordIndex] = useState(() => Math.floor(Math.random() * welcomeWords.length));
  const [welcomeText, setWelcomeText] = useState(() => welcomeWords[welcomeWordIndex]);
  const [welcomeDeleting, setWelcomeDeleting] = useState(false);
  const [showIntro, setShowIntro] = useState(() => sessionStorage.getItem('studymate_intro_seen_v3') !== 'true');
  const [activePage, setActivePage] = useState<'planner' | 'tips' | 'dictionary' | 'game' | 'chess' | 'bible'>('planner');
  const [bibleBook, setBibleBook] = useState('John');
  const [bibleChapter, setBibleChapter] = useState('3');
  const [bibleText, setBibleText] = useState('');
  const [bibleReference, setBibleReference] = useState('');
  const [bibleLoading, setBibleLoading] = useState(false);
  const [bibleError, setBibleError] = useState('');
  const [dailyClock, setDailyClock] = useState(() => new Date());
  const [tipCategory, setTipCategory] = useState('All');
  const [dictionaryQuery, setDictionaryQuery] = useState('');
  const [dictionaryLetter, setDictionaryLetter] = useState('All');
  const [dictionaryResults, setDictionaryResults] = useState<OnlineDictionaryEntry[]>([]);
  const [dictionarySearchedWord, setDictionarySearchedWord] = useState('');
  const [dictionaryLoading, setDictionaryLoading] = useState(false);
  const [dictionaryError, setDictionaryError] = useState('');

  useEffect(() => { const id = window.setInterval(() => setDailyClock(new Date()), 30000); return () => window.clearInterval(id); }, []);

  async function lookupBibleChapter() {
    const chapter = Number(bibleChapter);
    if (!Number.isInteger(chapter) || chapter < 1 || chapter > bibleChapterCounts[bibleBook]) { setBibleError('Enter a valid chapter number for this book.'); return; }
    setBibleLoading(true); setBibleError(''); setBibleText(''); setBibleReference('');
    try {
      const response = await fetch('https://bible-api.com/' + encodeURIComponent(bibleBook + ' ' + chapter) + '?translation=kjv');
      if (!response.ok) throw new Error('Unable to load');
      const data = await response.json() as {reference?:string;verses?:Array<{verse:number;text:string}>};
      if (!data.verses?.length) throw new Error('No verses returned');
      setBibleReference(data.reference || bibleBook + ' ' + chapter);
      setBibleText(data.verses.map(v => v.verse + '. ' + v.text.trim()).join('\\n'));
    } catch { setBibleError('Could not load this chapter. Check your connection and try again.'); }
    finally { setBibleLoading(false); }
  }

  async function lookupDictionaryWord() {
    const term = dictionaryQuery.trim();
    if (!term) {
      setDictionaryError('Type an English word first.');
      setDictionaryResults([]);
      setDictionarySearchedWord('');
      return;
    }
    setDictionaryLoading(true);
    setDictionaryError('');
    setDictionarySearchedWord(term);
    setDictionaryResults([]);
    try {
      const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(term)}`);
      if (!response.ok) throw new Error('No dictionary entry was found.');
      const data = await response.json() as OnlineDictionaryEntry[];
      if (!Array.isArray(data) || data.length === 0) throw new Error('No dictionary entry was found.');
      setDictionaryResults(data);
    } catch {
      setDictionaryError(`No entry found for “${term}”. Check the spelling or try another English word.`);
    } finally {
      setDictionaryLoading(false);
    }
  }

  function enterStudyMate() {
    sessionStorage.setItem('studymate_intro_seen_v3', 'true');
    setShowIntro(false);
  }

  const completed = tasks.filter(task => task.done).length;
  const active = tasks.length - completed;
  const progress = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;
  const problem = currentProblems[problemOrder[problemIndex]];
  const currentGrade = practiceResults[problem.number];
  const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
  const secs = String(seconds % 60).padStart(2, '0');
  const greetingName = useMemo(() => {
    const name = user?.name?.trim();
    return name ? name.split(' ')[0] : 'Student';
  }, [user]);

  useEffect(() => {
    const fullText = welcomeWords[welcomeWordIndex];
    const delay = welcomeDeleting ? 55 : welcomeText === fullText ? 1500 : 90;
    const timer = window.setTimeout(() => {
      if (welcomeDeleting) {
        const nextText = welcomeText.slice(0, -1);
        setWelcomeText(nextText);
        if (!nextText) {
          let nextIndex = Math.floor(Math.random() * welcomeWords.length);
          while (welcomeWords.length > 1 && nextIndex === welcomeWordIndex) {
            nextIndex = Math.floor(Math.random() * welcomeWords.length);
          }
          setWelcomeWordIndex(nextIndex);
          setWelcomeDeleting(false);
        }
      } else if (welcomeText === fullText) {
        setWelcomeDeleting(true);
      } else {
        setWelcomeText(fullText.slice(0, welcomeText.length + 1));
      }
    }, delay);
    return () => window.clearTimeout(timer);
  }, [welcomeDeleting, welcomeText, welcomeWordIndex]);

  useEffect(() => {
    void loadUser();
  }, []);


  useEffect(() => {
    localStorage.setItem('studymate_tasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('studymate_practice_results', JSON.stringify(practiceResults));
  }, [practiceResults]);

  useEffect(() => {
    localStorage.setItem('studymate_problem_order', JSON.stringify(problemOrder));
    localStorage.setItem('studymate_practice_set', String(practiceSet));
    localStorage.setItem('studymate_weak_subjects', JSON.stringify(weakSubjects));
    localStorage.setItem('studymate_completed_review', JSON.stringify(completedSetReview));
    localStorage.setItem('studymate_show_review', String(showSetReview));
  }, [problemOrder, practiceSet, weakSubjects, completedSetReview, showSetReview]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setSeconds(value => {
        if (value <= 1) {
          setRunning(false);
          return 1500;
        }
        return value - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (!user) return;
    const timeout = window.setTimeout(() => {
      void saveState(tasks, practiceResults);
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [tasks, practiceResults, user]);

  async function loadUser() {
    try {
      const current = await auth.getUser();
      if (!current) return;
      setUser(current);
      setSyncing(true);
      const response = await api.get('/api/state');
      setTasks(Array.isArray(response.data?.tasks) ? response.data.tasks : []);
      setPracticeResults(response.data?.practiceResults && typeof response.data.practiceResults === 'object' ? response.data.practiceResults : {});
      const savedWeak = Array.isArray(response.data?.weakSubjects) ? response.data.weakSubjects : weakSubjects;
      setWeakSubjects(savedWeak);
      if (Array.isArray(response.data?.completedSetReview)) setCompletedSetReview(response.data.completedSetReview);
      setSyncMessage('Synced to your account');
    } catch {
      setSyncMessage('Account connected; local progress is still available');
    } finally {
      setSyncing(false);
    }
  }

  async function signIn() {
    if (authBusy) return;
    setAuthBusy(true);
    try {
      const result = await auth.signIn({ scope: 'openid email profile offline_access' });
      setUser(result.user);
      setSyncing(true);
      const response = await api.get('/api/state');
      setTasks(Array.isArray(response.data?.tasks) ? response.data.tasks : []);
      setPracticeResults(response.data?.practiceResults && typeof response.data.practiceResults === 'object' ? response.data.practiceResults : {});
      setSyncMessage('Synced to your account');
      setShowMenu(false);
    } catch {
      setSyncMessage('Sign-in was cancelled or unavailable');
    } finally {
      setSyncing(false);
      setAuthBusy(false);
    }
  }

  async function signOut() {
    await auth.signOut();
    setUser(null);
    setSyncMessage('Signed out. Progress stays on this device.');
    setShowMenu(false);
  }

  async function saveState(nextTasks: Task[], nextResults: Record<number, GradeResult>, nextWeakSubjects = weakSubjects, nextReview = completedSetReview) {
    if (!user) return;
    try {
      setSyncing(true);
      await api.put('/api/state', { tasks: nextTasks, practiceResults: nextResults, weakSubjects: nextWeakSubjects, completedSetReview: nextReview });
      setSyncMessage('All progress synced');
    } catch {
      setSyncMessage('Could not sync right now');
    } finally {
      setSyncing(false);
    }
  }

  function addTask() {
    if (!title.trim() || !deadline) return;
    setTasks(current => [...current, { id: Date.now(), title: title.trim(), deadline, done: false }]);
    setTitle('');
    setDeadline('');
    setShowAddTask(false);
  }

  function addExampleTask(example: { title: string; days: number }) {
    setTasks(current => [
      ...current,
      { id: Date.now() + Math.floor(Math.random() * 1000), title: example.title, deadline: datePlusDays(example.days), done: false },
    ]);
  }

  function goToProblem(index: number) {
    setProblemIndex((index + currentProblems.length) % currentProblems.length);
    setShowApproach(false);
  }

  function submitGrade() {
    const result = gradeProblem(problem, answers[problem.number] || '');
    const nextResults = { ...practiceResults, [problem.number]: result };
    const finishedSet = currentProblems.every(item => Boolean(nextResults[item.number]));
    if (finishedSet) {
      const total = currentProblems.reduce((sum, item) => sum + (nextResults[item.number]?.score || 0), 0);
      const weak = currentProblems.filter(item => (nextResults[item.number]?.score || 0) < 70).map(item => item.subject);
      const uniqueWeak = Array.from(new Set(weak));
      const review = currentProblems.map(item => ({ problem: item, answer: answers[item.number] || '', grade: nextResults[item.number] }));
      const finalScore = Math.round(total / currentProblems.length);
      setLastSetScore(finalScore);
      setWeakSubjects(uniqueWeak);
      setCompletedSetReview(review);
      setShowSetReview(true);
      setShowApproach(false);
      void saveState(tasks, nextResults, uniqueWeak, review);
      return;
    }
    setPracticeResults(nextResults);
    void saveState(tasks, nextResults);
    setShowApproach(true);
  }

  function startNextSet() {
    const nextSet = practiceSet + 1;
    const generated = buildGeneratedSet(nextSet, weakSubjects);
    setCurrentProblems(generated);
    setProblemOrder(shuffleProblemIndexes());
    setProblemIndex(0);
    setAnswers({});
    setPracticeResults({});
    setShowApproach(false);
    setCompletedSetReview(null);
    setShowSetReview(false);
    setPracticeSet(nextSet);
  }

  return (
    <>
      <div className="planner-video-background" aria-hidden="true">
        <video muted playsInline preload="metadata">
          <source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260821_114821_a8ca298f-be2c-4613-a4dd-51b69e16bbde.mp4" type="video/mp4" />
        </video>
      </div>
      {showIntro && (
        <section className="cinematic-hero" aria-label="StudyMate introduction">
          <video className="cinematic-video" autoPlay loop muted playsInline preload="auto"><source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260314_131748_f2ca2a28-fed7-44c8-b9a9-bd9acdd5ec31.mp4" type="video/mp4" /></video>
          <nav className="cinematic-nav">
            <div className="cinematic-logo">StudyMate<sup>®</sup></div>
            <div className="cinematic-links"><button>Home</button><button>Planner</button><button>Practice</button><button>Focus</button><button>Support</button></div>
            <button className="liquid-glass cinematic-nav-cta" onClick={enterStudyMate}>Begin Journey</button>
          </nav>
          <div className="cinematic-hero-content">
            <h1>Small steps. <em>Big goals.</em> Keep moving forward.</h1>
            <p>You don't have to finish everything at once. Start with one task, give it your focus, and let every small win bring you closer to your goals.</p>
            <button className="liquid-glass cinematic-main-cta" onClick={enterStudyMate}>Begin Journey</button>
          </div>
        </section>
      )}
      <main className="app-shell" id="top">
      <header className="topbar">
        <div className="brand"><div className="brand-mark" aria-label="StudyMate logo"><BookOpen size={29} strokeWidth={2.4} /></div><span>StudyMate</span></div>
        <div className="topbar-actions">
          {user ? (
            <button className="profile-pill" onClick={() => setShowMenu(value => !value)}>
              <span className="profile-avatar">{(user.name || user.email || 'S').charAt(0).toUpperCase()}</span>
              <span className="profile-name">{greetingName}</span>
            </button>
          ) : (
            <button className="login-button" onClick={() => void signIn()}><UserRound size={18} />{authBusy ? 'Signing in...' : 'Log in'}</button>
          )}
          <button className="menu-button" aria-label="Open menu" onClick={() => setShowMenu(value => !value)}>
            {showMenu ? <X size={26} /> : <Menu size={28} />}
          </button>
        </div>
        {showMenu && (
          <div className="account-menu">
            {user ? (
              <>
                <div className="account-info"><strong>{user.name || 'Student'}</strong><span>{user.email || 'Account connected'}</span></div>
                <button className="menu-action" onClick={() => void signOut()}>Log out</button>
              </>
            ) : (
              <>
                <div className="account-info"><strong>Save your progress</strong><span>Log in to sync tasks, grades, and progress across your devices.</span></div>
                <button className="menu-action" onClick={() => void signIn()}>Log in or sign up</button>
              </>
            )}
          </div>
        )}
      </header>

      <nav className="main-tabs" aria-label="StudyMate sections">
        <button className={activePage === 'planner' ? 'main-tab active' : 'main-tab'} onClick={() => setActivePage('planner')}><Check size={17} /> Planner</button>
        <button className={activePage === 'tips' ? 'main-tab active' : 'main-tab'} onClick={() => setActivePage('tips')}><Sparkles size={17} /> Tips &amp; Tricks</button>
        <button className={activePage === 'dictionary' ? 'main-tab active' : 'main-tab'} onClick={() => setActivePage('dictionary')}><BookOpen size={17} /> Dictionary</button>
        <button className={activePage === 'game' ? 'main-tab active' : 'main-tab'} onClick={() => setActivePage('game')}><Gamepad2 size={17} /> Multiplayer Quiz</button>
        <button className={activePage === 'chess' ? 'main-tab active' : 'main-tab'} onClick={() => setActivePage('chess')}><span aria-hidden="true">♞</span> Chess</button>
        <button className={activePage === 'bible' ? 'main-tab active' : 'main-tab'} onClick={() => setActivePage('bible')}><BookMarked size={17} /> Bible</button>

      </nav>
      {activePage === 'planner' && (
      <div className="content">
        <section className="daily-faith-card">
          <div className="daily-faith-kicker"><Heart size={16}/> DAILY WORD · NEW DAY AT 6:00 AM</div>
          <span className="daily-faith-date">{dailyClock.toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}</span>
          <h2>Today's Bible Verse</h2><blockquote>{dailyBibleVerse(dailyClock).text}</blockquote><strong className="daily-faith-reference">{dailyBibleVerse(dailyClock).reference}</strong>
          <div className="daily-faith-prayer"><h3>Prayer to Start the Day</h3><p>Heavenly Father, thank You for the gift of this new day. Please guide my thoughts, words, and actions. Give me wisdom to learn, patience when things are difficult, courage to do what is right, and kindness toward others. Help me use my time well and remember that I do not have to face every challenge alone. May my work bring good to the people around me. In Jesus’ name, Amen.</p></div>
          <button className="daily-faith-link" onClick={() => setActivePage('bible')}>Explore the Bible <ArrowRight size={16}/></button>
        </section>
        <section className="welcome-section">
          <div className="date-row">
            <span>{getToday().toUpperCase()} · {getTime()} PHT</span>
            <button className="help-button" aria-label="Help"><span>?</span><ChevronRight size={18} /></button>
          </div>
          <div className="welcome-kicker"><span className="kicker-dot" /> STUDYMATE · YOUR STUDY SPACE</div>
          <h1>Welcome, <span className="welcome-name">{greetingName}</span><span className="welcome-pause">.</span><br /><span className="typed-wrap"><span className="typed-word">{welcomeText}</span><span className="typing-caret" aria-hidden="true" /></span></h1>
          <p>Let’s organize the next step, not everything at once.</p>
          <div className="sync-line">
            <span className={user ? 'status-dot connected' : 'status-dot'} />
            {syncing ? 'Syncing your progress…' : syncMessage || (user ? 'Your progress is connected to your account' : 'Log in to sync your progress')}
          </div>
        </section>

        <section className="momentum-card">
          <div className="momentum-orbit orbit-one" /><div className="momentum-orbit orbit-two" /><div className="momentum-dot" />
          <span className="section-label light">YOUR MOMENTUM</span>
          <h2>{active ? 'You have a clear next step.' : 'Your workspace is ready.'}</h2>
          <p>{active ? active + (active === 1 ? ' task is waiting. Take it one at a time.' : ' tasks are waiting. Take them one at a time.') : 'Add your first task and start building your rhythm.'}</p>
          <div className="momentum-stats">
            <div className="progress-ring" style={{ '--progress': progress + '%' } as CSSProperties}><div>{progress}%</div></div>
            <div><strong>{completed} / {tasks.length}</strong><span>tasks<br />completed</span></div>
          </div>
        </section>

        <section className="surface-card task-card" id="tasks">
          <div className="card-heading">
            <div className="heading-copy">
              <div className="section-label"><Check size={16} /> TASK PLANNER</div>
              <h2>To-do list</h2>
              <p>Deadlines first, pressure later.</p>
            </div>
            <button className="add-button" onClick={() => setShowAddTask(value => !value)}><Plus size={20} />Add task</button>
          </div>

          {showAddTask && (
            <div className="add-form">
              <label>Assignment<input value={title} onChange={event => setTitle(event.target.value)} placeholder="e.g. Mathematics Activity" /></label>
              <label>Deadline<input type="date" value={deadline} onChange={event => setDeadline(event.target.value)} /></label>
              <div className="form-actions"><button className="save-task" onClick={addTask}>Add task</button><button className="cancel-task" onClick={() => setShowAddTask(false)}>Cancel</button></div>
              <div className="examples-block">
                <span>Example tasks</span>
                <div className="example-grid">
                  {exampleTasks.map(example => (
                    <button key={example.title} className="example-task" onClick={() => addExampleTask(example)}>+ {example.title}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="task-list">
            {tasks.length === 0 ? (
              <div className="empty-task"><Circle size={25} /><div><strong>No tasks yet</strong><span>Use Add task or choose an example to start your list.</span></div></div>
            ) : (
              tasks.map(task => (
                <div className="task-row" key={task.id}>
                  <button className={task.done ? 'task-check done' : 'task-check'} aria-label={task.done ? 'Mark task active' : 'Mark task complete'} onClick={() => setTasks(current => current.map(item => item.id === task.id ? { ...item, done: !item.done } : item))}>{task.done ? <Check size={18} /> : null}</button>
                  <div className="task-copy"><strong className={task.done ? 'completed-title' : ''}>{task.title}</strong><span className={task.done ? 'task-state complete' : 'task-state'}><Clock3 size={15} />{task.done ? 'Complete' : 'Due ' + formatDate(task.deadline)}</span></div>
                  <span className="task-date">{formatDate(task.deadline)}</span>
                  <button className="delete-task" aria-label="Delete task" onClick={() => setTasks(current => current.filter(item => item.id !== task.id))}><Trash2 size={18} /></button>
                </div>
              ))
            )}
          </div>
          <div className="task-footer"><span><b>{active}</b> active · <b>{completed}</b> done</span><span>Keep the rhythm</span></div>
        </section>

        <section className="timer-card" id="timer">
          <div className="timer-orbit" />
          <div className="timer-top"><div><div className="section-label light"><Clock3 size={16} /> FOCUS ROOM</div><h2>Study timer</h2><p>One session. One clear goal.</p></div></div>
          <div className="timer-modes"><button className="timer-mode active">◎ Focus 25</button><button className="timer-mode">☕ Break 05</button></div>
          <div className="timer-circle"><span>{mins}:{secs}</span></div>
          <p className="timer-ready">{running ? 'Stay focused.' : 'Ready to begin?'}</p>
          <div className="timer-actions">
            <button className="timer-start" onClick={() => setRunning(value => !value)}><Play size={19} fill="currentColor" />{running ? 'Pause' : 'Start'}</button>
            <button className="timer-reset" onClick={() => { setRunning(false); setSeconds(1500); }}><RotateCcw size={18} />Reset</button>
          </div>
          <div className="timer-note"><Clock3 size={16} />25 min focus · 5 min break</div>
        </section>

        <section className="surface-card practice-card" id="practice">
          <div className="practice-heading">
            <div className="section-label"><Brain size={17} /> PROBLEM-SOLVING PRACTICE</div>
            <div className="problem-count"><Sparkles size={16} /><span>Set {practiceSet} · {problemIndex + 1} / {currentProblems.length}</span></div>
            <h2>Try before you peek</h2>
            <p>Practice the thinking process, not just the answer.</p>
          </div>
          <div className="problem-body">
            {showSetReview && completedSetReview && (
              <div className="set-review">
                <div className="set-review-heading">
                  <div><span>SET {practiceSet} COMPLETE</span><strong>{lastSetScore}%</strong><p>Here is every answer, grade, and solution from this set.</p></div>
                  <button className="submit-answer" onClick={startNextSet}><Sparkles size={18} />Generate new set</button>
                </div>
                {weakSubjects.length > 0 && <div className="weakness-card"><strong>Focus for your next set</strong><p>{weakSubjects.join(' · ')}</p><span>Your lower-scoring topics will be included again with targeted practice.</span></div>}
                <div className="review-list">
                  {completedSetReview.map(item => (
                    <div className="review-item" key={item.problem.number}>
                      <div><span>{item.problem.subject} · PROBLEM {String(item.problem.number).padStart(2, '0')}</span><strong>{item.grade.score}%</strong></div>
                      <p><b>Your answer:</b> {item.answer || 'No answer'}</p>
                      <p><b>Expected answer:</b> {item.problem.answer}</p>
                      <p>{item.problem.approach}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <span className="problem-label">{problem.subject} · PROBLEM {String(problem.number).padStart(2, '0')}</span>
            <h3>{problem.problem}</h3>
            <p className="hint"><span>♧</span> {problem.hint}</p>
            <span className="take-time">◔ &nbsp;Take 2–3 minutes</span>
          </div>
          <div className="answer-area">
            <p>Write your answer below, then grade it to see your score out of 100%.</p>
            <label>YOUR ANSWER<textarea value={answers[problem.number] || ''} onChange={event => setAnswers(current => ({ ...current, [problem.number]: event.target.value }))} placeholder="Type your answer or show your steps here..." rows={5} /></label>
            <button className="submit-answer" onClick={submitGrade}><Check size={19} />Grade my answer</button>

            {currentGrade && (
              <div className="grade-card">
                <div className="grade-top">
                  <div><span>Your score</span><strong>{currentGrade.score}%</strong></div>
                  <div className="score-bar"><div style={{ width: currentGrade.score + '%' }} /></div>
                </div>
                <p className="grade-message">{currentGrade.message}</p>
                <div className="strengths">
                  <strong>What you did well</strong>
                  {currentGrade.strengths.length ? currentGrade.strengths.map(strength => <span key={strength}>✓ {strength}</span>) : <span>Keep practicing and compare your work with the approach below.</span>}
                </div>
                <button className="peek-button" onClick={() => setShowApproach(value => !value)}>{showApproach ? 'Hide suggested approach' : 'Show suggested approach'}</button>
              </div>
            )}

            {!currentGrade && !showApproach && (
              <button className="secondary-peek" onClick={() => setShowApproach(true)}>Show suggested approach</button>
            )}

            {showApproach && (
              <div className="approach-box"><strong>Suggested approach</strong><p>{problem.approach}</p><p className="answer-key">Expected answer: <b>{problem.answer}</b></p></div>
            )}
          </div>
          <div className="practice-nav">
            <button onClick={() => goToProblem(problemIndex - 1)}>Previous</button>
            <span>Problem {problemIndex + 1} of {currentProblems.length}</span>
            <button onClick={() => goToProblem(problemIndex + 1)}>Next <ArrowRight size={16} /></button>
          </div>
          {!showSetReview && Object.keys(practiceResults).filter(key => currentProblems.some(item => item.number === Number(key))).length === currentProblems.length && (
            <div className="overall-grade">
              <div className="overall-grade-heading">
                <div>
                  <span className="section-label"><Sparkles size={16} /> FINAL PRACTICE RESULT</span>
                  <h3>Overall grade</h3>
                  <p>You completed all {currentProblems.length} problems.</p>
                </div>
                <strong>{Math.round(currentProblems.reduce((total, item) => total + (practiceResults[item.number]?.score || 0), 0) / currentProblems.length)}%</strong>
              </div>
              <div className="overall-score-bar"><div style={{ width: Math.round(currentProblems.reduce((total, item) => total + (practiceResults[item.number]?.score || 0), 0) / currentProblems.length) + '%' }} /></div>
              <div className="overall-details">
                <span>{Object.values(practiceResults).filter(result => result.score === 100).length} perfect</span>
                <span>{currentProblems.filter(item => (practiceResults[item.number]?.score || 0) >= 60).length} solid attempts</span>
                <span>{currentProblems.length} answered</span>
              </div>
              <p className="overall-message">Your overall grade is the average of all problem scores. Review any lower-scoring problems and try them again to improve your result.</p>
            </div>
          )}
        </section>

      </div>
      )}

      {activePage === 'game' && <QuizGame />}
      {activePage === 'chess' && <ChessGame />}

      {activePage === 'tips' && (
        <div className="content">
          <section className="surface-card resource-card" id="tips-and-tricks">
            <div className="resource-heading">
              <div className="section-label"><Sparkles size={17} /> TIPS &amp; TRICKS</div>
              <h2>Manage your time. Solve with confidence.</h2>
              <p>Practical student strategies for planning tasks, using time wisely, and working through problems when the answer is not obvious.</p>
            </div>
            <div className="tips-panel">
              <div className="tip-filters">
                {['All', 'Planning', 'Problem Solving', 'Focus', 'Memory', 'Notes', 'Exams', 'Research'].map(category => <button key={category} className={tipCategory === category ? 'letter-filter active' : 'letter-filter'} onClick={() => setTipCategory(category)}>{category}</button>)}
              </div>
              <div className="tips-grid">
                {studyTips.filter(tip => tipCategory === 'All' || tip.category === tipCategory).map(tip => (
                  <article className="tip-item" key={tip.title}><span>{tip.category}</span><h3>{tip.title}</h3><p>{tip.detail}</p></article>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}

      {activePage === 'dictionary' && (
        <div className="content dictionary-page">
          <section className="surface-card resource-card" id="dictionary">
            <div className="resource-heading">
              <div className="section-label"><BookOpen size={17} /> ENGLISH–ENGLISH DICTIONARY</div>
              <h2>Find the meaning of a word.</h2>
              <p>Search a wide online English dictionary for definitions, pronunciation, examples, synonyms, and antonyms when available. Browse the sample word list by letter, too.</p>
            </div>
            <div className="dictionary-panel">
              <form className="dictionary-lookup" onSubmit={event => { event.preventDefault(); void lookupDictionaryWord(); }}>
                <label className="dictionary-search">Search any English word
                  <input value={dictionaryQuery} onChange={event => setDictionaryQuery(event.target.value)} placeholder="Try curious, resilient, or photosynthesis" autoComplete="off" />
                </label>
                <button className="dictionary-search-button" type="submit" disabled={dictionaryLoading}>{dictionaryLoading ? 'Searching…' : 'Search dictionary'}</button>
              </form>
              <p className="dictionary-note">Online lookup · English definitions · Results may include multiple meanings and word forms</p>
              {dictionaryLoading && <p className="dictionary-status">Looking up “{dictionarySearchedWord}”…</p>}
              {dictionaryError && <p className="dictionary-error" role="status">{dictionaryError}</p>}
              {dictionaryResults.length > 0 && (
                <div className="dictionary-list online-results">
                  {dictionaryResults.map((entry, index) => (
                    <article className="dictionary-entry online-entry" key={`${entry.word}-${index}`}>
                      <div className="online-word-heading">
                        <div><h3>{entry.word}</h3>{entry.phonetic && <span className="phonetic-text">{entry.phonetic}</span>}</div>
                        {entry.phonetics?.find(item => item.audio)?.audio && <button className="audio-button" type="button" onClick={() => { const audioUrl = entry.phonetics?.find(item => item.audio)?.audio || ''; const audio = new Audio(audioUrl.startsWith('//') ? `https:${audioUrl}` : audioUrl); void audio.play().catch(() => setDictionaryError('Audio could not be played on this device.')); }}>▶ Listen</button>}
                      </div>
                      {entry.meanings.map((meaning, meaningIndex) => (
                        <div className="online-meaning" key={`${meaning.partOfSpeech}-${meaningIndex}`}>
                          <span>{meaning.partOfSpeech}</span>
                          {meaning.definitions.map((definition, definitionIndex) => (
                            <div className="online-definition" key={`${definition.definition}-${definitionIndex}`}>
                              <p><b>{definitionIndex + 1}.</b> {definition.definition}</p>
                              {definition.example && <small>Example: {definition.example}</small>}
                              {definition.synonyms && definition.synonyms.length > 0 && <small><b>Synonyms:</b> {definition.synonyms.join(', ')}</small>}
                              {definition.antonyms && definition.antonyms.length > 0 && <small><b>Antonyms:</b> {definition.antonyms.join(', ')}</small>}
                            </div>
                          ))}
                          {meaning.synonyms && meaning.synonyms.length > 0 && <small className="word-relations"><b>More synonyms:</b> {meaning.synonyms.slice(0, 16).join(', ')}</small>}
                          {meaning.antonyms && meaning.antonyms.length > 0 && <small className="word-relations"><b>More antonyms:</b> {meaning.antonyms.slice(0, 16).join(', ')}</small>}
                        </div>
                      ))}
                    </article>
                  ))}
                </div>
              )}
              {!dictionarySearchedWord && (
                <div className="dictionary-browse">
                  <h3>Browse A–Z</h3>
                  <div className="alphabet-filters" aria-label="Browse sample words by letter">
                    <button className={dictionaryLetter === 'All' ? 'letter-filter active' : 'letter-filter'} onClick={() => setDictionaryLetter('All')} type="button">All</button>
                    {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(letter => <button key={letter} type="button" className={dictionaryLetter === letter ? 'letter-filter active' : 'letter-filter'} onClick={() => setDictionaryLetter(letter)}>{letter}</button>)}
                  </div>
                  <p className="dictionary-count">{dictionaryEntries.filter(entry => (dictionaryLetter === 'All' || entry.word.toUpperCase().startsWith(dictionaryLetter)) && (entry.word.toLowerCase().includes(dictionaryQuery.toLowerCase().trim()) || entry.meaning.toLowerCase().includes(dictionaryQuery.toLowerCase().trim()))).length} sample words</p>
                  <div className="dictionary-list">
                    {dictionaryEntries.filter(entry => (dictionaryLetter === 'All' || entry.word.toUpperCase().startsWith(dictionaryLetter)) && (entry.word.toLowerCase().includes(dictionaryQuery.toLowerCase().trim()) || entry.meaning.toLowerCase().includes(dictionaryQuery.toLowerCase().trim()))).map(entry => (
                      <article className="dictionary-entry" key={entry.word}><div><h3>{entry.word.replace(/^eX/, 'Ex')}</h3><span>{entry.part}</span></div><p>{entry.meaning}</p><small>Example: {entry.example}</small></article>
                    ))}
                    {dictionaryEntries.filter(entry => (dictionaryLetter === 'All' || entry.word.toUpperCase().startsWith(dictionaryLetter)) && (entry.word.toLowerCase().includes(dictionaryQuery.toLowerCase().trim()) || entry.meaning.toLowerCase().includes(dictionaryQuery.toLowerCase().trim()))).length === 0 && <p className="dictionary-empty">No sample words for this letter. Search online for a word above.</p>}
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {activePage === 'bible' && (
        <div className="content bible-page"><section className="surface-card resource-card" id="bible-library">
          <div className="resource-heading"><div className="section-label"><BookMarked size={17}/> BIBLE LIBRARY · KING JAMES VERSION</div><h2>Explore the Bible.</h2><p>Browse all 66 books and their chapters, then read each chapter's verses. This library uses the public-domain King James Version (KJV).</p></div>
          <div className="bible-panel"><div className="daily-faith-card bible-featured-verse"><div className="daily-faith-kicker"><Heart size={16}/> TODAY'S VERSE</div><blockquote>{dailyBibleVerse(dailyClock).text}</blockquote><strong className="daily-faith-reference">{dailyBibleVerse(dailyClock).reference}</strong><p className="bible-reset-note">Changes at 6:00 AM in your device's local time.</p></div>
            <form className="bible-lookup" onSubmit={event=>{event.preventDefault();void lookupBibleChapter();}}>
              <label className="dictionary-search">Book of the Bible<select value={bibleBook} onChange={event=>setBibleBook(event.target.value)}>{bibleBooks.map(book=><option key={book}>{book}</option>)}</select></label>
              <label className="dictionary-search">Chapter<input type="number" min="1" max={bibleChapterCounts[bibleBook]} value={bibleChapter} onChange={event=>setBibleChapter(event.target.value)}/></label>
              <button className="dictionary-search-button" type="submit" disabled={bibleLoading}><Search size={16}/>{bibleLoading?'Loading…':'Read chapter'}</button>
            </form>
            <p className="bible-chapter-hint">Select any book and chapter. Chapter text loads when you press Read chapter.</p>
            {bibleError&&<p className="dictionary-error" role="status">{bibleError}</p>}
            {bibleText&&<article className="bible-chapter-results"><h3>{bibleReference}</h3><div className="bible-verses">{bibleText.split('\\n').filter(line=>line.trim()).map((line,index)=><p key={index}>{line}</p>)}</div></article>}
          </div></section></div>
      )}

      <footer className="developer-footer">
        <div className="developer-footer-inner">
          <span>Developed for StudyMate</span>
          <span className="developer-footer-separator">·</span>
          <a
            href="https://www.facebook.com/profile.php?id=61578909298183"
            target="_blank"
            rel="noreferrer"
          >
            Contact Support
          </a>
        </div>
      </footer>
    </main>
    </>
  );
}

export default App;
