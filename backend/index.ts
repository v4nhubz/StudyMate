import { router, json, error, requireAuth } from '@appdeploy/sdk';
import { db } from '@appdeploy/sdk';
import { notifySubscribers, realtimeSubscriptionRoutes } from './realtime-subscribers';
import { Chess } from 'chess.js';

type Task = { id: number; title: string; deadline: string; done: boolean };
type GradeResult = { score: number; strengths: string[]; message: string };
type CompletedReview = { problem: unknown; answer: string; grade: GradeResult };
type PlannerState = { userId: string; tasks: Task[]; practiceResults?: Record<string, GradeResult>; weakSubjects?: string[]; completedSetReview?: CompletedReview[] | null };

type QuestionType = 'multiple-choice' | 'true-false' | 'short-answer';
type QuizQuestion = { prompt: string; choices: string[]; correctIndex?: number; correctAnswer?: string; type?: QuestionType; category?: string };
type QuizPlayer = { id: string; name: string; score: number; answers: Record<string, number | string> };
type QuizRoomRecord = {
  roomCode: string; hostId: string; hostToken: string; status: 'waiting' | 'countdown' | 'playing' | 'finished';
  currentQuestionIndex: number; players: QuizPlayer[]; questions: QuizQuestion[]; createdAt: number;
  questionType: QuestionType; timeLimit: number; questionStartedAt?: number; countdownStartedAt?: number;
};

const quizQuestionBank: QuizQuestion[] = [
  { prompt: 'A student buys 3 notebooks for ₱25 each and pays with ₱100. How much change should they receive?', choices: ['₱15', '₱20', '₱25', '₱30'], correctIndex: 1 },
  { prompt: 'A bus travels 150 km in 3 hours at a steady speed. How far will it travel in 5 hours?', choices: ['200 km', '225 km', '250 km', '300 km'], correctIndex: 2 },
  { prompt: 'A recipe for 4 people uses 2 cups of rice. How many cups are needed for 10 people?', choices: ['4 cups', '5 cups', '6 cups', '8 cups'], correctIndex: 1 },
  { prompt: 'A class has 36 students. If 2/3 of them join a club, how many students join?', choices: ['12', '18', '24', '30'], correctIndex: 2 },
  { prompt: 'A phone costs ₱8,000 and is discounted by 15%. What is the sale price?', choices: ['₱6,500', '₱6,800', '₱7,000', '₱7,200'], correctIndex: 1 },
  { prompt: 'A water tank contains 120 liters. If 35 liters are used each day, how much remains after 2 days?', choices: ['40 liters', '50 liters', '60 liters', '70 liters'], correctIndex: 1 },
  { prompt: 'Find the next number: 3, 6, 12, 24, __.', choices: ['30', '36', '42', '48'], correctIndex: 3 },
  { prompt: 'Five workers finish a job in 8 days. If all work at the same rate, how many days would 10 workers need?', choices: ['2 days', '4 days', '6 days', '16 days'], correctIndex: 1 },
  { prompt: 'A rectangular garden is 9 m long and 4 m wide. What is its perimeter?', choices: ['13 m', '26 m', '36 m', '40 m'], correctIndex: 1 },
  { prompt: 'A bag has 3 red, 2 blue, and 5 green balls. Without looking, what is the probability of picking a blue ball?', choices: ['1/5', '1/4', '1/3', '1/2'], correctIndex: 0 },
  { prompt: 'Mia scores 80, 90, and 70 on three tests. What score does she need on the fourth test to average 85?', choices: ['90', '95', '100', '105'], correctIndex: 2 },
  { prompt: 'A jeepney fare is ₱13 per passenger. What is the total fare for 7 passengers?', choices: ['₱81', '₱91', '₱93', '₱101'], correctIndex: 1 },
  { prompt: 'A number multiplied by 4, then increased by 6, equals 30. What is the number?', choices: ['4', '5', '6', '8'], correctIndex: 2 },
  { prompt: 'A student reads 18 pages each day. How many days are needed to finish a 126-page book?', choices: ['6', '7', '8', '9'], correctIndex: 1 },
  { prompt: 'A map uses a scale of 1 cm to 5 km. Two towns are 7 cm apart on the map. What is the real distance?', choices: ['12 km', '25 km', '30 km', '35 km'], correctIndex: 3 },
  { prompt: 'A store sells a shirt for ₱450 after a ₱150 discount. What was its original price?', choices: ['₱500', '₱550', '₱600', '₱650'], correctIndex: 2 },
  { prompt: 'Three consecutive whole numbers add up to 42. What is the largest number?', choices: ['13', '14', '15', '16'], correctIndex: 2 },
  { prompt: 'A car uses 8 liters of fuel to travel 96 km. At the same rate, how far can it travel with 15 liters?', choices: ['160 km', '170 km', '180 km', '192 km'], correctIndex: 2 },
  { prompt: 'A box contains 24 chocolates. Ana gives 1/4 to her friend and then gives 1/3 of the remaining chocolates to her brother. How many are left?', choices: ['8', '10', '12', '14'], correctIndex: 2 },
  { prompt: 'A school event starts at 9:35 AM and lasts 2 hours 45 minutes. What time does it end?', choices: ['12:10 PM', '12:20 PM', '12:30 PM', '12:40 PM'], correctIndex: 1 },
  { prompt: 'A printer prints 45 pages in 3 minutes. At the same rate, how long will 180 pages take?', choices: ['9 minutes', '10 minutes', '12 minutes', '15 minutes'], correctIndex: 2 },
  { prompt: 'The ratio of cats to dogs at a shelter is 3:5. If there are 40 animals, how many are dogs?', choices: ['15', '20', '25', '30'], correctIndex: 2 },
  { prompt: 'A number is increased by 20% and becomes 72. What was the original number?', choices: ['50', '55', '60', '62'], correctIndex: 2 },
  { prompt: 'A team wins 6 games, draws 2, and loses 2. If a win earns 3 points and a draw earns 1, how many points does it earn?', choices: ['18', '20', '22', '24'], correctIndex: 1 },
];

function shuffled<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function choiceQuestion(prompt: string, answer: string | number, distractors: Array<string | number>, category: string): QuizQuestion {
  const correctAnswer = String(answer);
  const options = Array.from(new Set([correctAnswer, ...distractors.map(String)])).filter(Boolean);
  while (options.length < 4) options.push('Alternative ' + (options.length + 1));
  const choices = shuffled(options).slice(0, 4);
  return { prompt, choices, correctIndex: choices.indexOf(correctAnswer), correctAnswer, type: 'multiple-choice', category };
}

function numericQuestion(prompt: string, answer: number, step: number, prefix = '', suffix = '', category = 'Math'): QuizQuestion {
  const distractors = shuffled([-3, -2, -1, 1, 2, 3].map(offset => Math.max(0, answer + offset * step)).filter(value => value !== answer));
  const values = [answer, ...distractors.filter(value => value !== answer)].slice(0, 4);
  while (values.length < 4) values.push(answer + (values.length + 1) * Math.max(1, step));
  const format = (value: number) => prefix + Number(value.toFixed(2)).toString() + suffix;
  const choices = shuffled(values).map(format);
  return { prompt, choices, correctIndex: choices.indexOf(format(answer)), correctAnswer: format(answer), type: 'multiple-choice', category };
}

function generateQuestionVariant(): QuizQuestion {
  const kind = Math.floor(Math.random() * 32);
  const pick = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)];
  if (kind === 0) {
    const price = 250 + Math.floor(Math.random() * 16) * 50;
    const discount = pick([10, 12, 15, 20, 25, 30]);
    const sale = price * (100 - discount) / 100;
    return numericQuestion(pick([
      `A backpack marked ₱${price} is on sale for ${discount}% off. What is the new price?`,
      `A shop reduces a ₱${price} backpack by ${discount}%. How much does a customer pay?`,
      `After a ${discount}% discount, what will a ₱${price} school bag cost?`
    ]), sale, Math.max(10, price / 20), '₱', '', 'Money & Percentages');
  }
  if (kind === 1) {
    const speed = 30 + Math.floor(Math.random() * 15) * 5;
    const hours = 2 + Math.floor(Math.random() * 6);
    return numericQuestion(pick([
      `A ferry moves at ${speed} km/h for ${hours} hours. What distance does it cover?`,
      `At ${speed} kilometers per hour, how far will a vehicle travel in ${hours} hours?`,
      `A cyclist keeps a steady speed of ${speed} km/h for ${hours} hours. Find the distance.`
    ]), speed * hours, speed, '', ' km', 'Physics & Motion');
  }
  if (kind === 2) {
    const prompts = [
      ['Which plant process uses sunlight to turn water and carbon dioxide into sugar?', 'Photosynthesis', ['Respiration', 'Digestion', 'Evaporation']],
      ['What gas do plants absorb from the air during photosynthesis?', 'Carbon dioxide', ['Oxygen', 'Hydrogen', 'Helium']],
      ['Which plant structure mainly takes in water from soil?', 'Roots', ['Petals', 'Fruit', 'Pollen']]
    ];
    const item = pick(prompts);
    return choiceQuestion(item[0], item[1], item[2], 'Biology');
  }
  if (kind === 3) {
    const elements = [
      ['sodium', 'Na', ['So', 'S', 'Sd']], ['iron', 'Fe', ['Ir', 'I', 'In']],
      ['gold', 'Au', ['Gd', 'Ag', 'Go']], ['helium', 'He', ['H', 'Hl', 'Hm']],
      ['oxygen', 'O', ['Ox', 'Og', 'Oy']], ['carbon', 'C', ['Ca', 'Co', 'Cb']]
    ];
    const item = pick(elements);
    return choiceQuestion(pick([`Which chemical symbol stands for ${item[0]}?`, `In the periodic table, what is the symbol for ${item[0]}?`, `Choose the correct element symbol for ${item[0]}.`]), item[1], item[2], 'Chemistry');
  }
  if (kind === 4) {
    const places = [
      ['Japan', 'Tokyo', ['Kyoto', 'Osaka', 'Seoul']], ['Australia', 'Canberra', ['Sydney', 'Perth', 'Melbourne']],
      ['Thailand', 'Bangkok', ['Phuket', 'Hanoi', 'Manila']], ['Canada', 'Ottawa', ['Toronto', 'Vancouver', 'Montreal']],
      ['France', 'Paris', ['Lyon', 'Nice', 'Brussels']], ['South Korea', 'Seoul', ['Busan', 'Tokyo', 'Taipei']]
    ];
    const item = pick(places);
    return choiceQuestion(pick([`Which city is the capital of ${item[0]}?`, `A traveler visits ${item[0]}. Which city is its national capital?`, `Select the capital city of ${item[0]}.`]), item[1], item[2], 'Geography');
  }
  if (kind === 5) {
    const items = [
      ['The collection of old maps ___ in the library.', 'is', ['are', 'were', 'be']],
      ['Neither of the two answers ___ correct.', 'is', ['are', 'were', 'have']],
      ['The students in the science club ___ every Friday.', 'meet', ['meets', 'meeting', 'has met']],
      ['Each of the players ___ a water bottle.', 'has', ['have', 'are having', 'were']]
    ];
    const item = pick(items);
    return choiceQuestion(pick(['Choose the verb that agrees with the subject: ', 'Complete the sentence using correct subject-verb agreement: ', 'Which word makes this sentence grammatically correct? ']) + item[0], item[1], item[2], 'Grammar');
  }
  if (kind === 6) {
    const words = [
      ['brief', 'short', ['distant', 'heavy', 'silent']], ['cautious', 'careful', ['careless', 'sleepy', 'cheerful']],
      ['rapid', 'quick', ['gentle', 'late', 'narrow']], ['assist', 'help', ['avoid', 'forget', 'refuse']],
      ['ancient', 'very old', ['brand-new', 'ordinary', 'tiny']]
    ];
    const item = pick(words);
    return choiceQuestion(pick([`Which word is closest in meaning to “${item[0]}”?`, `Choose a synonym for “${item[0]}”.`, `What is the best meaning of “${item[0]}”?`]), item[1], item[2], 'Vocabulary');
  }
  if (kind === 7) {
    const items = [
      ['fallen leaves', 'Decomposers break them down and return nutrients to the soil.', ['They turn them into sunlight.', 'They stop all plant growth.', 'They change them into rocks.']],
      ['mushrooms growing on a dead log', 'They help break down dead organic matter.', ['They make the log produce metal.', 'They remove gravity.', 'They create plastic.']],
      ['nutrients returning to an ecosystem', 'Decomposition', ['Condensation', 'Magnetism', 'Combustion']]
    ];
    const item = pick(items);
    return choiceQuestion(pick(['In an ecosystem, what best explains ', 'Which scientific idea describes ', 'Choose the best explanation for ']) + item[0] + '?', item[1], item[2], 'Ecology');
  }
  if (kind === 8) {
    const items = [
      ['Mars', 'often called the Red Planet', ['Neptune', 'Mercury', 'Earth']], ['Jupiter', 'the largest planet in our solar system', ['the smallest planet', 'the closest planet to the Sun', 'a dwarf planet']],
      ['Earth', 'the planet known for abundant liquid water on its surface', ['a planet with no atmosphere', 'the hottest planet', 'a star']]
    ];
    const item = pick(items);
    return choiceQuestion(pick([`Which statement best describes ${item[0]}?`, `Choose the accurate fact about ${item[0]}.`, `What is ${item[0]} known for in basic astronomy?`]), item[1], item[2], 'Astronomy');
  }
  if (kind === 9) {
    const items = [
      ['copy selected text', 'Ctrl + C', ['Ctrl + V', 'Ctrl + Z', 'Ctrl + P']],
      ['undo the last action', 'Ctrl + Z', ['Ctrl + S', 'Ctrl + F', 'Ctrl + X']],
      ['save the current document', 'Ctrl + S', ['Ctrl + A', 'Ctrl + W', 'Ctrl + B']],
      ['paste copied text', 'Ctrl + V', ['Ctrl + C', 'Ctrl + P', 'Ctrl + N']]
    ];
    const item = pick(items);
    return choiceQuestion(pick([`On a typical Windows computer, which shortcut will ${item[0]}?`, `Which keyboard command is used to ${item[0]}?`, `Choose the standard shortcut for ${item[0]}.`]), item[1], item[2], 'Computer Skills');
  }
  if (kind === 10) {
    const base = 3 + Math.floor(Math.random() * 12);
    const height = 2 + Math.floor(Math.random() * 10);
    return numericQuestion(pick([`A triangular sign has a base of ${base} cm and a height of ${height} cm. Find its area.`, `What is the area of a triangle measuring ${base} cm across the base and ${height} cm tall?`, `A triangle's base is ${base} cm and perpendicular height is ${height} cm. Calculate its area.`]), base * height / 2, Math.max(1, base), '', ' cm²', 'Geometry');
  }
  if (kind === 11) {
    const target = 1 + Math.floor(Math.random() * 6);
    return choiceQuestion(pick([`A fair six-sided die is rolled once. What is the chance of getting ${target}?`, `If a standard die is tossed, what is the probability it lands on ${target}?`, `One number is equally likely on a fair die. What is P(rolling ${target})?`]), '1/6', ['1/2', '1/3', '1/4'], 'Probability');
  }
  if (kind === 12) {
    const numerator = 1 + Math.floor(Math.random() * 8);
    const denominator = pick([2, 4, 5, 10]);
    const value = numerator / denominator;
    return numericQuestion(pick([`Convert ${numerator}/${denominator} to a decimal.`, `What decimal value is equal to the fraction ${numerator}/${denominator}?`, `Write ${numerator}/${denominator} in decimal form.`]), value, 0.1, '', '', 'Fractions & Decimals');
  }
  if (kind === 13) {
    const values = shuffled([5, 8, 11, 14, 17, 20, 23, 26, 29, 32]).slice(0, 5).sort((a, b) => a - b);
    const median = values[2];
    return choiceQuestion(pick([`Find the median of these values: ${values.join(', ')}.`, `A data set contains ${values.join(', ')}. What is its middle value?`, `What is the median when the numbers are ${values.join(', ')}?`]), median, [median + 2, Math.max(0, median - 3), median + 5], 'Statistics');
  }
  if (kind === 14) {
    const items = [
      ['When is Philippine Independence Day celebrated?', 'June 12', ['July 4', 'August 21', 'November 30']],
      ['Which event is commemorated on June 12 in the Philippines?', 'Philippine Independence Day', ['National Heroes Day', 'Bonifacio Day', 'Araw ng Kagitingan']],
      ['Who is widely known as the first president of the Philippines?', 'Emilio Aguinaldo', ['Andres Bonifacio', 'Apolinario Mabini', 'Manuel Quezon']]
    ];
    const item = pick(items);
    return choiceQuestion(item[0], item[1], item[2], 'Philippine History');
  }
  if (kind === 15) {
    const items = [
      ['“The classroom was a zoo.”', 'Metaphor', ['Simile', 'Hyperbole', 'Alliteration']],
      ['“The wind whispered through the trees.”', 'Personification', ['Onomatopoeia', 'Irony', 'Rhyme']],
      ['“Her bag weighs a ton.”', 'Hyperbole', ['Metaphor', 'Personification', 'Alliteration']],
      ['“Bright stars blinked.”', 'Alliteration', ['Simile', 'Oxymoron', 'Euphemism']]
    ];
    const item = pick(items);
    return choiceQuestion(pick([`Which figure of speech is used in ${item[0]}?`, `Identify the literary device in the sentence ${item[0]}`, `How is ${item[0]} best classified?`]), item[1], item[2], 'Literature');
  }
  if (kind === 16) {
    const items = [
      ['A message says you won a prize and asks for your password.', 'Do not share details; verify the sender through an official channel.', ['Reply with your password to claim it.', 'Forward it to everyone.', 'Open every attachment immediately.']],
      ['A stranger sends an unexpected link asking you to log in.', 'Check the website address and do not enter credentials if unsure.', ['Enter your password quickly.', 'Disable all account security.', 'Send the link to classmates.']],
      ['An app requests permissions that do not fit its purpose.', 'Review the permissions and avoid granting unnecessary access.', ['Approve everything automatically.', 'Share your account with strangers.', 'Turn off all updates.']]
    ];
    const item = pick(items);
    return choiceQuestion(pick(['What is the safest response? ', 'Which action shows good digital safety? ', 'Choose the most responsible choice: ']) + item[0], item[1], item[2], 'Digital Safety');
  }
  if (kind === 17) {
    const items = [
      ['protein', 'supports growth and repair of body tissues', ['is the body’s only source of water', 'replaces the need for sleep', 'turns bones into muscle']],
      ['fiber', 'supports healthy digestion', ['provides no role in digestion', 'is the same as oxygen', 'is a type of bone']],
      ['calcium', 'helps build and maintain strong bones and teeth', ['is the main fuel in gasoline', 'replaces all vitamins', 'is a blood cell']]
    ];
    const item = pick(items);
    return choiceQuestion(pick([`Which statement best describes ${item[0]}?`, `What is one important role of ${item[0]} in the body?`, `Select the accurate fact about ${item[0]}.`]), item[1], item[2], 'Health Science');
  }
  if (kind === 18) {
    const items = [
      ['quarter note', 'one beat in common time', ['two beats', 'four beats', 'half a beat']],
      ['half note', 'two beats in common time', ['one beat', 'three beats', 'four beats']],
      ['whole note', 'four beats in common time', ['one beat', 'two beats', 'eight beats']]
    ];
    const item = pick(items);
    return choiceQuestion(pick([`In common time, how long does a ${item[0]} usually last?`, `Which duration matches a ${item[0]} in 4/4 time?`, `Choose the usual beat value for a ${item[0]}.`]), item[1], item[2], 'Music');
  }
  if (kind === 19) {
    const items = [
      ['interprets laws', 'Judicial branch', ['Executive branch', 'Legislative branch', 'Election commission']],
      ['implements and enforces laws', 'Executive branch', ['Judicial branch', 'Legislative branch', 'Local library']],
      ['creates and passes laws', 'Legislative branch', ['Judicial branch', 'Executive branch', 'Weather bureau']]
    ];
    const item = pick(items);
    return choiceQuestion(pick([`Which branch of government ${item[0]}?`, `Who is responsible for the role that ${item[0]}?`, `Select the government branch that ${item[0]}.`]), item[1], item[2], 'Civics');
  }
  if (kind === 20) {
    const start = 1 + Math.floor(Math.random() * 10);
    const step = 2 + Math.floor(Math.random() * 5);
    const seq = [start, start + step, start + step * 2, start + step * 3];
    return numericQuestion(pick([`A number pattern reads ${seq.join(', ')}, … What comes next?`, `Continue the sequence ${seq.join(' → ')}.`, `Find the missing next term after ${seq.join(', ')}.`]), start + step * 4, step, '', '', 'Logic & Patterns');
  }
  if (kind === 21) {
    const items = [
      ['sunlight', 'Solar energy', ['Coal energy', 'Diesel energy', 'Natural gas energy']],
      ['moving air', 'Wind energy', ['Petrol energy', 'Plastic energy', 'Kerosene energy']],
      ['flowing water', 'Hydroelectric energy', ['Charcoal energy', 'Gasoline energy', 'Peat energy']]
    ];
    const item = pick(items);
    return choiceQuestion(pick([`Which renewable energy source uses ${item[0]}?`, `Energy can be generated from ${item[0]}. What is this source called?`, `Select the renewable energy type associated with ${item[0]}.`]), item[1], item[2], 'Environment');
  }
  if (kind === 22) {
    const scale = pick([2, 3, 4, 5, 8]);
    const mapDistance = 3 + Math.floor(Math.random() * 9);
    return numericQuestion(pick([`On a map, 1 cm represents ${scale} km. What real distance does ${mapDistance} cm represent?`, `A map scale is 1 cm : ${scale} km. Two places are ${mapDistance} cm apart. Find the real distance.`, `Using a scale of ${scale} km per centimeter, convert ${mapDistance} cm into kilometers.`]), scale * mapDistance, scale, '', ' km', 'Map Skills');
  }
  if (kind === 23) {
    const number = 2 + Math.floor(Math.random() * 20);
    const threshold = pick([5, 10, 12, 15, 20]);
    const answer = number > threshold ? 'The condition is true' : 'The condition is false';
    return choiceQuestion(pick([`A program checks “if ${number} > ${threshold}”. What is the result?`, `In a simple program, the condition ${number} > ${threshold} is tested. What does it return?`, `Evaluate the Boolean test ${number} > ${threshold}.`]), answer, [answer === 'The condition is true' ? 'The condition is false' : 'The condition is true', 'It returns a color', 'It creates a new number'], 'Computing Logic');
  }
  if (kind === 24) {
    const items = [
      ['You spend your last ₱100 on a movie ticket instead of a book.', 'The book you gave up buying', ['The movie screen', 'The money already spent last week', 'The cinema seats']],
      ['You study for a quiz instead of attending a game.', 'The game you chose not to attend', ['The quiz paper', 'Your pencil', 'The classroom door']],
      ['You use your free afternoon to work instead of resting.', 'The rest time you gave up', ['Your work schedule', 'A calendar date', 'A chair']]
    ];
    const item = pick(items);
    return choiceQuestion(pick([`In economics, what is the opportunity cost? ${item[0]}`, `Which option represents the opportunity cost here? ${item[0]}`, `Identify the next-best alternative given up: ${item[0]}`]), item[1], item[2], 'Economics');
  }
  if (kind === 25) {
    const items = [
      ['A classmate explains a problem you do not understand.', 'Listen carefully, then ask a clarifying question.', ['Interrupt and change the topic.', 'Pretend to listen while using your phone.', 'Laugh before hearing the explanation.']],
      ['A group member disagrees with your suggestion.', 'Ask why and consider their reasons respectfully.', ['Insult their idea immediately.', 'Refuse to hear any explanation.', 'Tell everyone to stop talking.']],
      ['You receive feedback on a presentation.', 'Hear the full feedback and ask how to improve.', ['Argue before listening.', 'Ignore every comment.', 'Blame another student.']]
    ];
    const item = pick(items);
    return choiceQuestion(pick(['What response shows active listening? ', 'Which action best supports respectful communication? ', 'Choose the most constructive response: ']) + item[0], item[1], item[2], 'Communication');
  }
  if (kind === 26) {
    const items = [
      ['ice melting into liquid water', 'A change of state from solid to liquid', ['A chemical change creating a new element', 'A change from gas to plasma only', 'A process that removes all mass']],
      ['water vapor forming droplets on a cool glass', 'Condensation', ['Sublimation', 'Combustion', 'Rusting']],
      ['a puddle disappearing on a warm day', 'Evaporation', ['Freezing', 'Deposition', 'Magnetization']]
    ];
    const item = pick(items);
    return choiceQuestion(pick([`Which scientific process describes ${item[0]}?`, `How should this change be classified: ${item[0]}?`, `Choose the correct explanation for ${item[0]}.`]), item[1], item[2], 'States of Matter');
  }
  if (kind === 27) {
    const first = 25 + Math.floor(Math.random() * 50);
    const second = 25 + Math.floor(Math.random() * (120 - first));
    const third = 180 - first - second;
    return numericQuestion(pick([`Two angles of a triangle are ${first}° and ${second}°. Find the third angle.`, `A triangle has angles ${first}° and ${second}°. What is the remaining angle?`, `The first two angles measure ${first}° and ${second}°. Calculate the last one.`]), third, 5, '', '°', 'Geometry');
  }
  if (kind === 28) {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const day = pick(days);
    const sales = 20 + Math.floor(Math.random() * 15) * 5;
    return choiceQuestion(pick([`A chart shows that a store sold ${sales} drinks on ${day}. Which value should be recorded for ${day}?`, `In a sales table, ${day} has ${sales} drinks sold. What is the recorded count?`, `A bar graph labels ${day} with ${sales} units. What quantity does that bar represent?`]), sales, [sales + 5, Math.max(0, sales - 10), sales + 15], 'Data Interpretation');
  }
  if (kind === 29) {
    const startHour = 7 + Math.floor(Math.random() * 8);
    const startMinute = pick([0, 10, 15, 20, 30, 40, 45, 50]);
    const duration = pick([35, 45, 55, 70, 80, 95, 110, 125]);
    const total = startHour * 60 + startMinute + duration;
    const hour24 = Math.floor(total / 60) % 24;
    const minute = total % 60;
    const formatTime = (h: number, m: number) => {
      const suffix = h >= 12 ? 'PM' : 'AM';
      const hour12 = h % 12 || 12;
      return `${hour12}:${String(m).padStart(2, '0')} ${suffix}`;
    };
    const answer = formatTime(hour24, minute);
    const wrong = [formatTime(hour24, (minute + 15) % 60), formatTime((hour24 + 1) % 24, minute), formatTime((hour24 + 11) % 24, minute)];
    return choiceQuestion(pick([`A workshop begins at ${formatTime(startHour, startMinute)} and lasts ${duration} minutes. When does it end?`, `If a school activity starts at ${formatTime(startHour, startMinute)} and runs for ${duration} minutes, what is the finish time?`, `Calculate the ending time for a ${duration}-minute session that starts at ${formatTime(startHour, startMinute)}.`]), answer, wrong, 'Time & Scheduling');
  }
  if (kind === 30) {
    const items = [
      ['before we leave we should check the weather', 'Before we leave, we should check the weather.', ['before we leave we should check the weather.', 'Before we leave we should check, the weather.', 'Before, we leave we should check the weather.']],
      ['maya asked where the library was', 'Maya asked, “Where is the library?”', ['maya asked where the library was.', 'Maya asked where, the library was?', 'Maya asked “where the library was”.']],
      ['the experiment worked however we repeated it', 'The experiment worked; however, we repeated it.', ['The experiment worked however we repeated it', 'The experiment worked, however we repeated it.', 'The experiment worked; however we repeated it']]
    ];
    const item = pick(items);
    return choiceQuestion(pick([`Choose the correctly punctuated version of: “${item[0]}.”`, `Which option uses capitalization and punctuation correctly for “${item[0]}”?`, `Select the best edited sentence: “${item[0]}.”`]), item[1], item[2], 'Writing & Punctuation');
  }
  const items = [
    ['a crowbar lifting a heavy lid', 'Lever', ['Pulley', 'Wheel and axle', 'Screw']],
    ['a ramp used to move a box into a truck', 'Inclined plane', ['Pulley', 'Wedge', 'Gear']],
    ['a fixed wheel with a rope used to raise a flag', 'Pulley', ['Wedge', 'Screw', 'Inclined plane']],
    ['a knife splitting a piece of fruit', 'Wedge', ['Pulley', 'Lever', 'Wheel and axle']]
  ];
  const item = pick(items);
  return choiceQuestion(pick([`Which simple machine is being used in this example: ${item[0]}?`, `Identify the simple machine that helps with ${item[0]}.`, `What type of simple machine is described by ${item[0]}?`]), item[1], item[2], 'Engineering');
}

async function makeRandomQuizQuestions(): Promise<QuizQuestion[]> {
  const historyTable = 'quiz_question_history';
  const { items } = await db.list<{ prompt: string }>(historyTable, { limit: 10000 });
  const usedPrompts = new Set(items.map(item => item.prompt));
  const questions: QuizQuestion[] = [];
  const usedCategories = new Set<string>();
  const attemptsLimit = 5000;
  for (let attempt = 0; attempt < attemptsLimit && questions.length < 10; attempt++) {
    const question = generateQuestionVariant();
    if (usedPrompts.has(question.prompt) || questions.some(existing => existing.prompt === question.prompt)) continue;
    if (question.category && usedCategories.has(question.category)) continue;
    questions.push(question);
    if (question.category) usedCategories.add(question.category);
  }
  if (questions.length < 10) throw new Error('Could not prepare a fresh question set. Please create a new game again.');
  const records = questions.map(question => ({ prompt: question.prompt, usedAt: Date.now() }));
  await db.add(historyTable, records as unknown as Record<string, unknown>[]);
  return questions;
}
async function makeQuizQuestions(source: string, questionType: QuestionType, customText: string): Promise<QuizQuestion[]> {
  let questions: QuizQuestion[];
  if (source === 'custom') {
    questions = customText.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map((line, index) => {
      const parts = line.split('|').map(part => part.trim());
      if (parts.length < 2 || !parts[0] || !parts[1]) throw new Error('Custom question ' + (index + 1) + ' needs a prompt and correct answer separated by |.');
      if (questionType === 'multiple-choice') {
        if (parts.length < 3) throw new Error('Multiple-choice question ' + (index + 1) + ' needs at least one wrong choice.');
        const choices = parts.slice(1).filter(Boolean);
        const correctAnswer = choices[0];
        for (let i = choices.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [choices[i], choices[j]] = [choices[j], choices[i]]; }
        return { prompt: parts[0], choices, correctIndex: choices.indexOf(correctAnswer), correctAnswer, type: questionType };
      }
      if (questionType === 'true-false') {
        const answer = parts[1].toLowerCase();
        if (!['true', 'false'].includes(answer)) throw new Error('True/false question ' + (index + 1) + ' must have True or False as its answer.');
        return { prompt: parts[0], choices: ['True', 'False'], correctIndex: answer === 'true' ? 0 : 1, correctAnswer: answer === 'true' ? 'True' : 'False', type: questionType };
      }
      return { prompt: parts[0], choices: [], correctAnswer: parts[1].toLowerCase(), type: questionType };
    });
  } else {
    questions = (await makeRandomQuizQuestions()).map(question => {
      const correctAnswer = question.choices[question.correctIndex];
      if (questionType === 'multiple-choice') return { ...question, correctAnswer, type: questionType };
      if (questionType === 'short-answer') return { prompt: question.prompt, choices: [], correctAnswer: correctAnswer.toLowerCase(), type: questionType, category: question.category };
      const claim = question.choices[Math.floor(Math.random() * question.choices.length)];
      const statement = question.prompt + ' Proposed answer: ' + claim + '. Is this correct?';
      return { prompt: statement, choices: ['True', 'False'], correctIndex: claim === correctAnswer ? 0 : 1, correctAnswer: claim === correctAnswer ? 'True' : 'False', type: questionType, category: question.category };
    });
  }
  if (!questions.length) throw new Error('Add at least one question.');
  for (let i = questions.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [questions[i], questions[j]] = [questions[j], questions[i]]; }
  return source === 'custom' ? questions : questions.slice(0, 10);
}

function quizTable(code: string) { return 'quiz_room_' + code; }
function validQuizCode(value: unknown) {
  const code = String(value || '').trim().replace(/\D/g, '');
  return /^\d{6}$/.test(code) ? code : '';
}
async function findQuizRoom(code: string) {
  const { items } = await db.list<QuizRoomRecord>(quizTable(code), { limit: 1 });
  return items[0] || null;
}
function publicQuizRoom(room: QuizRoomRecord & { id: string }) {
  const question = room.questions[room.currentQuestionIndex];
  const answerKey = String(room.currentQuestionIndex);
  const answerRevealAt = (room.questionStartedAt || 0) + room.timeLimit * 1000;
  const allPlayersAnswered = room.players.length > 0 && room.players.every(player => player.answers[answerKey] !== undefined);
  const revealAnswer = room.status === 'finished' || (room.status === 'playing' && (allPlayersAnswered || Date.now() >= answerRevealAt));
  return {
    roomCode: room.roomCode,
    hostId: room.hostId,
    status: room.status,
    currentQuestionIndex: room.currentQuestionIndex,
    players: room.players.map(player => ({
      id: player.id,
      name: player.name,
      score: player.score,
      answeredCurrent: player.answers[answerKey] !== undefined,
      ...(revealAnswer ? {
        currentAnswer: player.answers[answerKey],
        answerCorrect: question?.choices?.length
          ? player.answers[answerKey] === question.correctIndex
          : String(player.answers[answerKey] ?? '').trim().toLowerCase() === String(question?.correctAnswer ?? '').trim().toLowerCase(),
      } : {}),
      isHost: player.id === room.hostId,
    })),
    questions: room.questions.map(question => ({
      prompt: question.prompt, choices: question.choices, type: question.type, category: question.category,
      ...(revealAnswer ? { correctIndex: question.correctIndex, correctAnswer: question.correctAnswer } : {}),
    })),
    questionType: room.questionType,
    timeLimit: room.timeLimit,
    questionStartedAt: room.questionStartedAt,
    countdownStartedAt: room.countdownStartedAt,
  };
}
async function saveQuizRoom(code: string, room: QuizRoomRecord & { id: string }) {
  const { id, ...record } = room;
  const [saved] = await db.update(quizTable(code), [{ id, record }]);
  if (!saved) throw new Error('Could not save quiz room.');
  const fresh = await findQuizRoom(code);
  if (!fresh) throw new Error('Quiz room could not be loaded after saving.');
  await notifySubscribers('quiz_room', code, publicQuizRoom(fresh));
  return publicQuizRoom(fresh);
}

type ChessRoomRecord = { roomCode: string; status: 'waiting' | 'playing' | 'finished'; whiteId: string; blackId: string | null; whiteName: string; blackName: string | null; fen: string; moves: string[]; result?: string; createdAt?: number; startedAt?: number; endedAt?: number; durationSeconds?: number };
type ChessProfile = { userId: string; name: string; trophies: number; updatedAt: number };
async function getChessProfile(userId: string) {
  const { items } = await db.list<ChessProfile>('chess_profiles', { filter: { userId }, limit: 1 });
  return items[0] || null;
}
async function saveChessProfile(userId: string, name: string, trophies?: number) {
  const existing = await getChessProfile(userId);
  const record: ChessProfile = { userId, name: name.trim().slice(0, 24) || existing?.name || 'Player', trophies: Math.max(0, Math.floor(trophies ?? existing?.trophies ?? 0)), updatedAt: Date.now() };
  if (existing) { const [ok] = await db.update('chess_profiles', [{ id: existing.id, record }]); if (!ok) throw new Error('Could not save profile.'); }
  else { const [id] = await db.add('chess_profiles', [record]); if (!id) throw new Error('Could not create profile.'); }
  return record;
}
async function findChessRoom(code: string) {
  const { items } = await db.list<ChessRoomRecord>('chess_room_' + code, { limit: 1 });
  return items[0] || null;
}
function publicChessRoom(room: ChessRoomRecord) {
  return { roomCode: room.roomCode, status: room.status, whiteId: room.whiteId, blackId: room.blackId, whiteName: room.whiteName, blackName: room.blackName, fen: room.fen, moves: room.moves, result: room.result, createdAt: room.createdAt, startedAt: room.startedAt, endedAt: room.endedAt, durationSeconds: room.durationSeconds };
}
async function saveChessRoom(room: ChessRoomRecord & { id: string }) {
  const { id, ...record } = room;
  const [ok] = await db.update('chess_room_' + room.roomCode, [{ id, record }]);
  if (!ok) throw new Error('Could not save game.');
  const fresh = await findChessRoom(room.roomCode);
  if (!fresh) throw new Error('Could not reload game.');
  await notifySubscribers('chess_room', room.roomCode, publicChessRoom(fresh));
  return publicChessRoom(fresh);
}

type ChessRoomRecord = { roomCode: string; status: 'waiting' | 'playing' | 'finished'; whiteId: string; blackId: string | null; whiteName: string; blackName: string | null; fen: string; moves: string[]; result?: string; createdAt?: number; startedAt?: number; endedAt?: number; durationSeconds?: number };
type ChessProfile = { userId: string; name: string; trophies: number; updatedAt: number };




























type TugPlayerRecord = { id: string; name: string; team: 'blue' | 'red'; correct: number; wrong: number; answered: Record<string, number>; questionIndex: number };
type TugRoomRecord = { roomCode: string; hostId: string; status: 'waiting' | 'playing' | 'finished'; players: TugPlayerRecord[]; questions: QuizQuestion[]; rope: number; createdAt: number; endsAt?: number; winner?: 'blue' | 'red' | 'draw' };
function tugTable(code: string) { return 'tug_room_' + code; }
async function findTugRoom(code: string) { const { items } = await db.list<TugRoomRecord>(tugTable(code), { limit: 1 }); return items[0] || null; }
function publicTugRoom(room: TugRoomRecord & { id: string }, playerId = '') {
 const p = room.players.find(x => x.id === playerId); const q = p ? room.questions[p.questionIndex] : null;
 return { roomCode: room.roomCode, status: room.status, hostId: room.hostId, players: room.players.map(x => ({ id:x.id,name:x.name,team:x.team,correct:x.correct,wrong:x.wrong })), rope:room.rope, endsAt:room.endsAt, winner:room.winner, currentQuestion:q?{prompt:q.prompt,choices:q.choices}:null, answeredCurrent:Boolean(p && p.answered[String(p.questionIndex)]!==undefined) };
}
async function saveTugRoom(room: TugRoomRecord & { id: string }) { const {id,...record}=room; const [ok]=await db.update(tugTable(room.roomCode),[{id,record}]); if(!ok)throw new Error('Save failed'); const fresh=await findTugRoom(room.roomCode); if(!fresh)throw new Error('Reload failed'); await notifySubscribers('tug_room',room.roomCode,publicTugRoom(fresh as TugRoomRecord & {id:string})); return fresh as TugRoomRecord & {id:string}; }
function finishTug(room:TugRoomRecord){if(room.status!=='playing')return;if(room.rope<=-100){room.rope=-100;room.winner='blue';room.status='finished'}else if(room.rope>=100){room.rope=100;room.winner='red';room.status='finished'}else if(room.endsAt && Date.now()>=room.endsAt){room.status='finished';room.winner=room.rope<0?'blue':room.rope>0?'red':'draw'}}
function makeTugQuestions(){const seen=new Set<string>();return shuffled(quizQuestionBank).filter(q=>{const a=String(q.choices[q.correctIndex??0]).toLowerCase().trim();if(seen.has(a))return false;seen.add(a);return true}).map(q=>({...q,correctAnswer:q.choices[q.correctIndex??0]}))}
export const handler = router({
  'POST /api/tug/create': [async ({body}) => {
 const v=body as {nickname?:string;playerId?:string}|null;const name=String(v?.nickname||'').trim().slice(0,20);const playerId=String(v?.playerId||'').trim();if(!name||!playerId)return error('Nickname and player ID are required.',400);
 let code='';for(let i=0;i<8;i++){const c=String(Math.floor(100000+Math.random()*900000));if(!(await findTugRoom(c))){code=c;break}}if(!code)return error('Could not create room.',500);
 const record:TugRoomRecord={roomCode:code,hostId:playerId,status:'waiting',players:[{id:playerId,name,team:'blue',correct:0,wrong:0,answered:{},questionIndex:0}],questions:makeTugQuestions(),rope:0,createdAt:Date.now()};
 const [id]=await db.add(tugTable(code),[record as unknown as Record<string,unknown>]);if(!id)return error('Could not create room.',500);return json({room:publicTugRoom({...record,id},playerId)});
 }],
 'POST /api/tug/join': [async ({body}) => {
 const v=body as {roomCode?:string;nickname?:string;playerId?:string}|null;const code=validQuizCode(v?.roomCode);const name=String(v?.nickname||'').trim().slice(0,20);const playerId=String(v?.playerId||'').trim();if(!code||!name||!playerId)return error('Enter a nickname and six-digit code.',400);
 const room=await findTugRoom(code);if(!room)return error('Room not found.',404);if(room.status!=='waiting')return error('Match already started.',409);
 if(!room.players.some(p=>p.id===playerId)){if(room.players.length>=40)return error('Room is full.',409);const b=room.players.filter(p=>p.team==='blue').length,r=room.players.filter(p=>p.team==='red').length;room.players.push({id:playerId,name,team:b<=r?'blue':'red',correct:0,wrong:0,answered:{},questionIndex:room.players.length%room.questions.length});const saved=await saveTugRoom({...room,id:room.id});return json({room:publicTugRoom(saved,playerId)})}
 return json({room:publicTugRoom(room as TugRoomRecord & {id:string},playerId)});
 }],
 'GET /api/tug/room/:code': [async ({params,query}) => {const code=validQuizCode(params.code);if(!code)return error('Invalid room code.',400);const room=await findTugRoom(code);if(!room)return error('Room not found.',404);return json({room:publicTugRoom(room as TugRoomRecord & {id:string},String(query.playerId||''))})}],
 'POST /api/tug/action': [async ({body}) => {
 const v=body as {roomCode?:string;playerId?:string;action?:string;choiceIndex?:number}|null;const code=validQuizCode(v?.roomCode);const playerId=String(v?.playerId||'').trim();if(!code||!playerId)return error('Room code and player ID are required.',400);const room=await findTugRoom(code);if(!room)return error('Room not found.',404);const p=room.players.find(x=>x.id===playerId);if(!p)return error('Join this room first.',403);finishTug(room);
 if(room.status==='finished'){const saved=await saveTugRoom({...room,id:room.id});return json({room:publicTugRoom(saved,playerId)})}
 if(v?.action==='start'){if(room.hostId!==playerId)return error('Only the host can start.',403);if(room.status!=='waiting'||room.players.length<2)return error('At least two players are needed.',409);room.status='playing';room.endsAt=Date.now()+60000}
 else if(v?.action==='answer'){if(room.status!=='playing')return error('Match is not accepting answers.',409);const q=room.questions[p.questionIndex];if(!q)return error('You have used all unique questions.',409);const key=String(p.questionIndex);if(p.answered[key]!==undefined)return error('Already answered.',409);const i=Number(v.choiceIndex);if(!Number.isInteger(i)||i<0||i>=q.choices.length)return error('Choose an answer.',400);const correct=i===q.correctIndex;p.answered[key]=i;if(correct){p.correct++;room.rope+=p.team==='blue'?-12:12}else{p.wrong++;room.rope+=p.team==='blue'?12:-12}p.questionIndex++;finishTug(room)}
 else return error('Unknown action.',400);
 try{const saved=await saveTugRoom({...room,id:room.id});return json({room:publicTugRoom(saved,playerId)})}catch{return error('Could not update room.',500)}
 }],
  ...realtimeSubscriptionRoutes,
  'GET /api/state': [
    requireAuth(),
    async ctx => {
      const { items } = await db.list<PlannerState>('planner_state', { filter: { userId: ctx.user!.userId }, limit: 1 });
      return json({
        tasks: items[0]?.tasks ?? [],
        practiceResults: items[0]?.practiceResults ?? {},
        weakSubjects: items[0]?.weakSubjects ?? [],
        completedSetReview: items[0]?.completedSetReview ?? null,
      });
    },
  ],
  'PUT /api/state': [
    requireAuth(),
    async ctx => {
      const body = ctx.body as { tasks?: Task[]; practiceResults?: Record<string, GradeResult>; weakSubjects?: string[]; completedSetReview?: CompletedReview[] | null } | null;
      const tasks = Array.isArray(body?.tasks) ? body.tasks : null;
      if (!tasks) return error('Invalid task data.', 400);
      const practiceResults = body?.practiceResults && typeof body.practiceResults === 'object' ? body.practiceResults : {};
      const weakSubjects = Array.isArray(body?.weakSubjects) ? body.weakSubjects : [];
      const completedSetReview = Array.isArray(body?.completedSetReview) ? body.completedSetReview : null;
      const { items } = await db.list<PlannerState>('planner_state', { filter: { userId: ctx.user!.userId }, limit: 1 });
      const record = { userId: ctx.user!.userId, tasks, practiceResults, weakSubjects, completedSetReview };
      if (items[0]) {
        const ok = await db.update('planner_state', [{ id: items[0].id, record }]);
        if (!ok[0]) return error('Could not save progress.', 500);
      } else {
        const [id] = await db.add('planner_state', [record]);
        if (!id) return error('Could not create your progress record.', 500);
      }
      return json({ saved: true, taskCount: tasks.length, gradedProblems: Object.keys(practiceResults).length });
    },
  ],
  'POST /api/quiz/create': [async ({ body }) => {
    const value = body as { nickname?: string; playerId?: string; source?: string; questionType?: QuestionType; timeLimit?: number; customQuestions?: string } | null;
    const nickname = String(value?.nickname || '').trim().slice(0, 20);
    const playerId = String(value?.playerId || '').trim();
    if (!nickname || !playerId) return error('Nickname and player ID are required.', 400);
    let room: (QuizRoomRecord & { id: string }) | null = null;
    let code = '';
    for (let attempt = 0; attempt < 8; attempt++) {
      code = String(Math.floor(100000 + Math.random() * 900000));
      if (await findQuizRoom(code)) continue;
      const hostToken = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
      const questionType: QuestionType = ['multiple-choice', 'true-false', 'short-answer'].includes(String(value?.questionType)) ? value!.questionType! : 'multiple-choice';
      const timeLimit = [10, 20, 30].includes(Number(value?.timeLimit)) ? Number(value?.timeLimit) : 20;
      let questions: QuizQuestion[];
      try { questions = await makeQuizQuestions(value?.source === 'custom' ? 'custom' : 'random', questionType, String(value?.customQuestions || '')); }
      catch (e: any) { return error(e?.message || 'Invalid custom questions.', 400); }
      const record: QuizRoomRecord = { roomCode: code, hostId: playerId, hostToken, status: 'waiting', currentQuestionIndex: 0, players: [{ id: playerId, name: nickname, score: 0, answers: {} }], questions, questionType, timeLimit, createdAt: Date.now() };
      const [id] = await db.add(quizTable(code), [record as unknown as Record<string, unknown>]);
      if (id) { room = { ...record, id }; break; }
    }
    if (!room) return error('Could not create a room. Please try again.', 500);
    return json({ room: publicQuizRoom(room), hostToken: room.hostToken, playerId });
  }],
  'POST /api/quiz/join': [async ({ body }) => {
    const value = body as { roomCode?: string; nickname?: string; playerId?: string } | null;
    const code = validQuizCode(value?.roomCode);
    const nickname = String(value?.nickname || '').trim().slice(0, 20);
    const playerId = String(value?.playerId || '').trim();
    if (!code || !nickname || !playerId) return error('Enter a valid room code and nickname.', 400);
    const room = await findQuizRoom(code);
    if (!room) return error('Room not found. Check the six-digit code.', 404);
    if (room.status !== 'waiting') return error('This game has already started.', 409);
    if (!room.players.some(player => player.id === playerId)) {
      if (room.players.length >= 40) return error('This room is full (40 players maximum).', 409);
      room.players.push({ id: playerId, name: nickname, score: 0, answers: {} });
      const publicRoom = await saveQuizRoom(code, room);
      return json({ room: publicRoom, playerId });
    }
    return json({ room: publicQuizRoom(room), playerId });
  }],
  'GET /api/quiz/room/:code': [async ({ params }) => {
    const code = validQuizCode(params.code);
    if (!code) return error('Invalid room code.', 400);
    const room = await findQuizRoom(code);
    if (!room) return error('Room not found. Check the six-digit code.', 404);
    return json({ room: publicQuizRoom(room) });
  }],
  'POST /api/quiz/claim-host': [async ({ body }) => {
    const value = body as { roomCode?: string; playerId?: string } | null;
    const code = validQuizCode(value?.roomCode);
    const playerId = String(value?.playerId || '').trim();
    if (!code || !playerId) return error('Room code and player ID are required.', 400);
    const room = await findQuizRoom(code);
    if (!room) return error('Room not found.', 404);
    if (room.hostId !== playerId || !room.players.some(player => player.id === playerId)) {
      return error('Only the current host can claim host controls.', 403);
    }
    return json({ hostToken: room.hostToken });
  }],
  'POST /api/quiz/action': [async ({ body }) => {
    const value = body as { roomCode?: string; playerId?: string; hostToken?: string | null; action?: string; choiceIndex?: number; answerText?: string } | null;
    const code = validQuizCode(value?.roomCode);
    const playerId = String(value?.playerId || '').trim();
    const action = String(value?.action || '');
    if (!code || !playerId) return error('Room code and player ID are required.', 400);
    const room = await findQuizRoom(code);
    if (!room) return error('Room not found.', 404);
    if (action === 'start' || action === 'next' || action === 'begin-question' || action === 'finish') {
      if (playerId !== room.hostId || !value?.hostToken || value.hostToken !== room.hostToken) return error('Only the host can control the quiz.', 403);
      if (action === 'start') {
        if (room.status !== 'waiting') return error('This quiz has already started.', 409);
        room.status = 'countdown';
        room.currentQuestionIndex = 0;
        room.countdownStartedAt = Date.now();
        delete room.questionStartedAt;
      } else if (action === 'next') {
        if (room.status !== 'playing') return error('The quiz is not currently playing.', 409);
        if (room.currentQuestionIndex >= room.questions.length - 1) room.status = 'finished';
        else {
          room.currentQuestionIndex += 1;
          room.status = 'countdown';
          room.countdownStartedAt = Date.now();
          delete room.questionStartedAt;
        }
      } else if (action === 'begin-question') {
        if (room.status !== 'countdown' || !room.countdownStartedAt) return error('There is no question countdown to start.', 409);
        if (Date.now() - room.countdownStartedAt < 3000) return error('Please wait for the 3-second countdown.', 409);
        room.status = 'playing';
        room.questionStartedAt = Date.now();
        delete room.countdownStartedAt;
      } else {
        room.status = 'finished';
      }
    } else if (action === 'answer') {
      if (room.status !== 'playing') return error('The quiz is not accepting answers right now.', 409);
      const player = room.players.find(item => item.id === playerId);
      if (!player) return error('Join this room before answering.', 403);
      const choiceIndex = Number(value?.choiceIndex);
      const question = room.questions[room.currentQuestionIndex];
      const answerKey = String(room.currentQuestionIndex);
      if (player.answers[answerKey] !== undefined) return error('You already answered this question.', 409);
      const elapsedMs = Math.max(0, Date.now() - (room.questionStartedAt || Date.now()));
      if (elapsedMs >= room.timeLimit * 1000) return error('Time is up for this question.', 409);
      let isCorrect = false;
      if (question.choices.length > 0) {
        if (!Number.isInteger(choiceIndex) || choiceIndex < 0 || choiceIndex >= question.choices.length) return error('Choose one of the listed answers.', 400);
        player.answers[answerKey] = choiceIndex;
        isCorrect = choiceIndex === question.correctIndex;
      } else {
        const answerText = String(value?.answerText || '').trim().toLowerCase();
        if (!answerText) return error('Type an answer first.', 400);
        player.answers[answerKey] = answerText;
        isCorrect = answerText === String(question.correctAnswer || '').trim().toLowerCase();
      }
      if (isCorrect) player.score += Math.max(0, 1000 - Math.floor(elapsedMs / 1000) * 60);
    } else {
      return error('Unknown quiz action.', 400);
    }
    try {
      const updatedRoom = await saveQuizRoom(code, room);
      return json({ room: updatedRoom });
    } catch {
      return error('Could not update the quiz room. Please try again.', 500);
    }
  }],
  'GET /api/chess/profile': [requireAuth(), async ctx => {
    const profile = await getChessProfile(ctx.user!.userId);
    return json({ name: profile?.name || ctx.user?.name || 'Player', trophies: profile?.trophies || 0 });
  }],
  'POST /api/chess/profile': [requireAuth(), async ctx => {
    const value = ctx.body as { name?: string } | null;
    try { const profile = await saveChessProfile(ctx.user!.userId, String(value?.name || ctx.user?.name || 'Player')); return json({ name: profile.name, trophies: profile.trophies }); }
    catch { return error('Could not save chess profile.', 500); }
  }],
  'POST /api/chess/create': [requireAuth(), async ctx => {
    const value = ctx.body as { name?: string } | null;
    const userId = ctx.user!.userId;
    const profile = await saveChessProfile(userId, String(value?.name || ctx.user?.name || 'Player'));
    let code = '';
    for (let i = 0; i < 8; i++) { const candidate = String(Math.floor(100000 + Math.random() * 900000)); if (!(await findChessRoom(candidate))) { code = candidate; break; } }
    if (!code) return error('Could not create a room. Try again.', 500);
    const record: ChessRoomRecord = { roomCode: code, status: 'waiting', whiteId: userId, blackId: null, whiteName: profile.name, blackName: null, fen: new Chess().fen(), moves: [], createdAt: Date.now() };
    const [id] = await db.add('chess_room_' + code, [record as unknown as Record<string, unknown>]);
    if (!id) return error('Could not create a room. Try again.', 500);
    return json({ room: publicChessRoom({ ...record, id }), playerColor: 'w' });
  }],
  'POST /api/chess/join': [requireAuth(), async ctx => {
    const value = ctx.body as { roomCode?: string; name?: string } | null;
    const code = String(value?.roomCode || '').replace(/\D/g, '').slice(0, 6);
    if (!/^\d{6}$/.test(code)) return error('Enter a valid six-digit code.', 400);
    const room = await findChessRoom(code);
    if (!room) return error('Room not found. Check the code.', 404);
    const userId = ctx.user!.userId;
    if (room.whiteId === userId || room.blackId === userId) return error('You created or already joined this room. Use a second account to play against yourself.', 409);
    if (room.status !== 'waiting') return error('This room has already started. Ask the host to create a new room.', 409);
    if (room.blackId) return error('This room is full. Ask the host to create a new room.', 409);
    const profile = await saveChessProfile(userId, String(value?.name || ctx.user?.name || 'Player'));
    const hostId = room.whiteId; const hostName = room.whiteName;
    if (Math.random() < 0.5) { room.whiteId = userId; room.whiteName = profile.name; room.blackId = hostId; room.blackName = hostName; }
    else { room.blackId = userId; room.blackName = profile.name; }
    room.status = 'playing';
    room.startedAt = Date.now();
    delete room.endedAt;
    delete room.durationSeconds;
    delete room.result;
    const saved = await saveChessRoom(room);
    return json({ room: saved, playerColor: room.whiteId === userId ? 'w' : 'b' });
  }],
  'GET /api/chess/room/:code': [requireAuth(), async ctx => {
    const code = String(ctx.params.code || '');
    if (!/^\d{6}$/.test(code)) return error('Invalid room code.', 400);
    const room = await findChessRoom(code);
    if (!room) return error('Room not found.', 404);
    if (room.whiteId !== ctx.user!.userId && room.blackId !== ctx.user!.userId) return error('Join this room to view it.', 403);
    return json({ room: publicChessRoom(room), playerColor: room.whiteId === ctx.user!.userId ? 'w' : 'b' });
  }],
  'POST /api/chess/move': [requireAuth(), async ctx => {
    const value = ctx.body as { roomCode?: string; from?: string; to?: string; promotion?: string } | null;
    const room = await findChessRoom(String(value?.roomCode || ''));
    if (!room) return error('Room not found.', 404);
    const userId = ctx.user!.userId;
    if (room.status !== 'playing' || (userId !== room.whiteId && userId !== room.blackId)) return error('You cannot move in this game.', 403);
    const game = new Chess(room.fen);
    if ((game.turn() === 'w' ? room.whiteId : room.blackId) !== userId) return error('Wait for your turn.', 409);
    try { const played = game.move({ from: String(value?.from || ''), to: String(value?.to || ''), promotion: String(value?.promotion || 'q') }); if (!played) return error('That is not a legal move.', 400); }
    catch { return error('That is not a legal move.', 400); }
    room.fen = game.fen(); room.moves = game.history();
    let trophies: number | undefined;
    if (game.isGameOver()) {
      room.status = 'finished';
      room.endedAt = Date.now();
      room.durationSeconds = Math.max(0, Math.floor((room.endedAt - (room.startedAt || room.endedAt)) / 1000));
      const draw = game.isDraw();
      const whiteWon = game.isCheckmate() && game.turn() === 'b';
      room.result = game.isStalemate() ? 'Stalemate — Draw' : game.isCheckmate() ? (whiteWon ? 'White wins by checkmate' : 'Black wins by checkmate') : game.isThreefoldRepetition() ? 'Draw by repetition' : game.isInsufficientMaterial() ? 'Draw by insufficient material' : draw ? 'Draw' : (whiteWon ? 'White wins' : 'Black wins');
      const whiteProfile = await getChessProfile(room.whiteId);
      const blackProfile = room.blackId ? await getChessProfile(room.blackId) : null;
      if (whiteProfile) await saveChessProfile(room.whiteId, whiteProfile.name, whiteProfile.trophies + (draw ? 5 : whiteWon ? 25 : -15));
      if (blackProfile && room.blackId) await saveChessProfile(room.blackId, blackProfile.name, blackProfile.trophies + (draw ? 5 : whiteWon ? -15 : 25));
      trophies = (await getChessProfile(userId))?.trophies || 0;
    }
    try { return json({ room: await saveChessRoom(room), trophies }); }
    catch { return error('Could not save the move.', 500); }
  }],
  'GET /api/chess/profile': [requireAuth(), async ctx => {
    const profile = await getChessProfile(ctx.user!.userId);
    return json({ name: profile?.name || ctx.user?.name || 'Player', trophies: profile?.trophies || 0 });
  }],
  'POST /api/chess/profile': [requireAuth(), async ctx => {
    const value = ctx.body as { name?: string } | null;
    try { const profile = await saveChessProfile(ctx.user!.userId, String(value?.name || ctx.user?.name || 'Player')); return json({ name: profile.name, trophies: profile.trophies }); }
    catch { return error('Could not save chess profile.', 500); }
  }],
  'POST /api/chess/create': [requireAuth(), async ctx => {
    const value = ctx.body as { name?: string } | null;
    const userId = ctx.user!.userId;
    const profile = await saveChessProfile(userId, String(value?.name || ctx.user?.name || 'Player'));
    let code = '';
    for (let i = 0; i < 8; i++) { const candidate = String(Math.floor(100000 + Math.random() * 900000)); if (!(await findChessRoom(candidate))) { code = candidate; break; } }
    if (!code) return error('Could not create a room. Try again.', 500);
    const record: ChessRoomRecord = { roomCode: code, status: 'waiting', whiteId: userId, blackId: null, whiteName: profile.name, blackName: null, fen: new Chess().fen(), moves: [], createdAt: Date.now() };
    const [id] = await db.add('chess_room_' + code, [record as unknown as Record<string, unknown>]);
    if (!id) return error('Could not create a room. Try again.', 500);
    return json({ room: publicChessRoom({ ...record, id }), playerColor: 'w' });
  }],
  'POST /api/chess/join': [requireAuth(), async ctx => {
    const value = ctx.body as { roomCode?: string; name?: string } | null;
    const code = String(value?.roomCode || '').replace(/\D/g, '').slice(0, 6);
    if (!/^\d{6}$/.test(code)) return error('Enter a valid six-digit code.', 400);
    const room = await findChessRoom(code);
    if (!room) return error('Room not found. Check the code.', 404);
    const userId = ctx.user!.userId;
    if (room.whiteId === userId || room.blackId === userId) return error('You created or already joined this room. Use a second account to play against yourself.', 409);
    if (room.status !== 'waiting') return error('This room has already started. Ask the host to create a new room.', 409);
    if (room.blackId) return error('This room is full. Ask the host to create a new room.', 409);
    const profile = await saveChessProfile(userId, String(value?.name || ctx.user?.name || 'Player'));
    const hostId = room.whiteId; const hostName = room.whiteName;
    if (Math.random() < 0.5) { room.whiteId = userId; room.whiteName = profile.name; room.blackId = hostId; room.blackName = hostName; }
    else { room.blackId = userId; room.blackName = profile.name; }
    room.status = 'playing';
    room.startedAt = Date.now();
    delete room.endedAt;
    delete room.durationSeconds;
    delete room.result;
    const saved = await saveChessRoom(room);
    return json({ room: saved, playerColor: room.whiteId === userId ? 'w' : 'b' });
  }],
  'GET /api/chess/room/:code': [requireAuth(), async ctx => {
    const code = String(ctx.params.code || '');
    if (!/^\d{6}$/.test(code)) return error('Invalid room code.', 400);
    const room = await findChessRoom(code);
    if (!room) return error('Room not found.', 404);
    if (room.whiteId !== ctx.user!.userId && room.blackId !== ctx.user!.userId) return error('Join this room to view it.', 403);
    return json({ room: publicChessRoom(room), playerColor: room.whiteId === ctx.user!.userId ? 'w' : 'b' });
  }],
  'POST /api/chess/move': [requireAuth(), async ctx => {
    const value = ctx.body as { roomCode?: string; from?: string; to?: string; promotion?: string } | null;
    const room = await findChessRoom(String(value?.roomCode || ''));
    if (!room) return error('Room not found.', 404);
    const userId = ctx.user!.userId;
    if (room.status !== 'playing' || (userId !== room.whiteId && userId !== room.blackId)) return error('You cannot move in this game.', 403);
    const game = new Chess(room.fen);
    if ((game.turn() === 'w' ? room.whiteId : room.blackId) !== userId) return error('Wait for your turn.', 409);
    try { const played = game.move({ from: String(value?.from || ''), to: String(value?.to || ''), promotion: String(value?.promotion || 'q') }); if (!played) return error('That is not a legal move.', 400); }
    catch { return error('That is not a legal move.', 400); }
    room.fen = game.fen(); room.moves = game.history();
    let trophies: number | undefined;
    if (game.isGameOver()) {
      room.status = 'finished';
      room.endedAt = Date.now();
      room.durationSeconds = Math.max(0, Math.floor((room.endedAt - (room.startedAt || room.endedAt)) / 1000));
      const draw = game.isDraw();
      const whiteWon = game.isCheckmate() && game.turn() === 'b';
      room.result = game.isStalemate() ? 'Stalemate — Draw' : game.isCheckmate() ? (whiteWon ? 'White wins by checkmate' : 'Black wins by checkmate') : game.isThreefoldRepetition() ? 'Draw by repetition' : game.isInsufficientMaterial() ? 'Draw by insufficient material' : draw ? 'Draw' : (whiteWon ? 'White wins' : 'Black wins');
      const whiteProfile = await getChessProfile(room.whiteId);
      const blackProfile = room.blackId ? await getChessProfile(room.blackId) : null;
      if (whiteProfile) await saveChessProfile(room.whiteId, whiteProfile.name, whiteProfile.trophies + (draw ? 5 : whiteWon ? 25 : -15));
      if (blackProfile && room.blackId) await saveChessProfile(room.blackId, blackProfile.name, blackProfile.trophies + (draw ? 5 : whiteWon ? -15 : 25));
      trophies = (await getChessProfile(userId))?.trophies || 0;
    }
    try { return json({ room: await saveChessRoom(room), trophies }); }
    catch { return error('Could not save the move.', 500); }
  }],
  ...realtimeSubscriptionRoutes,
});
