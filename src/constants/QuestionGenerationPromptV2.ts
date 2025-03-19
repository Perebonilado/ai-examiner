// Types
export type QuestionType =
  | 'Flash Cards'
  | 'Multiple Choice'
  | 'Multiple True-False'
  | 'Oral (Viva)';

export interface PromptConfigV2 {
  questionCount: number;
  sourceText: string;
  focusAreas?: string[];
  previousQuestions: string[];
  includeCaseStudies: boolean;
  questionType: QuestionType;
  difficulty: DifficultyType;
}

export type DifficultyType = 'easy' | 'medium' | 'hard';

// Constants for shared prompts
const DIFFICULTY_PROMPT = `ENSURE THAT EVERY QUESTION IS VERY DIFFICULT TO ANSWER. THE KIND OF DIFFICULTY THAT A COLLEGE PROFESSOR WOULD FIND CHALLENGING. THE QUESTIONS SHOULD REQUIRE THE USER TO HAVE A LONG TRAIN OF THOUGHTS BEFORE FIGURING OUT THE ANSWER FROM THE OPTIONS.`;

const VIVADIFFICULTYPROMPT = `ENSURE THE QUESTION IS STRAIGHTFORWARD AND SHORT! THE QUESTION SHOULD BE SHAPED IN A MANNER SUITABLE FOR A SHORT ORAL EXAMINATION. IT SHOULD REQUIRE THE USER TO EXPLAIN A CONCEPT OR DESCRIBE VERY BRIEFLY`;

const CRITICAL_DIVERSITY_INSTRUCTIONS = `
CRITICAL: Ensure each generated question is unique and diverse:
- Do not repeat question formats or topics within the same set of questions
- Explore different areas and subtopics within the given focus areas
- Vary the complexity and specificity of questions (from basic recall to more nuanced understanding)
- Use a mix of question types (e.g., definitions, functions, processes, historical facts, comparisons)
- If multiple questions relate to the same broad topic, approach it from different angles
- Consider less obvious or secondary aspects of the main topics to generate unique questions
- Utilize different cognitive skills (recall, understanding, application) across the question set
- If you've used a particular format, consciously choose a different one for the next question
- Regularly refer back to the source text to find fresh content for new questions
- Keep track of the questions you've generated to avoid repetition`;

const STATEMENT_CREATION_GUIDELINES = `
STATEMENT CREATION GUIDELINES:
1. Subtle Modifications:
   • Change qualifiers (e.g., "usually" to "always", "may" to "must")
   • Adjust temporal relationships ("before" to "after", "acute" to "chronic")
   • Modify numerical thresholds slightly (e.g., "greater than 5" to "greater than 4.5")
   • Alter cause-effect relationships subtly
   • Switch related but distinct terms (e.g., "inhibits" to "regulates")

2. Complex Truth Values:
   • Create statements that are technically true/false based on specific phrasing
   • Include compound statements where both parts must be evaluated
   • Use statements that are true in one context but false in another
   • Incorporate exceptions to general rules
   • Present statements that require understanding of subtle distinctions

3. Advanced Distraction Techniques:
   • Mix correct and incorrect elements within the same statement
   • Use partially correct statements that contain a crucial flaw
   • Include statements that sound plausible but contain subtle inaccuracies
   • Create options that require careful reading to spot minor but critical errors
   • Use precise scientific terminology where slight variations matter

4. Higher-Order Thinking Requirements:
   • Demand analysis of relationships between multiple concepts
   • Require evaluation of complex mechanisms or pathways
   • Need synthesis of information from different source text sections
   • Force consideration of multiple factors simultaneously
   • Challenge common misconceptions with nuanced statements`;

// Helper functions
const getTopicTaggingInstructions = (hasFocusAreas: boolean): string => `
TOPIC TAGGING INSTRUCTIONS [VERY IMPORTANT]:
- ${
  hasFocusAreas
    ? 'Tag each question PRECISELY to the specific focus area it covers'
    : 'IDENTIFY and TAG each question with the most appropriate topic from the source text'
}
- Topic tags should be EXTREMELY PRECISE and DIRECTLY RELATED to the question's content
- Use concise, specific topic names that clearly indicate the exact concept being tested
- Ensure each question is tagged to ONLY ONE primary topic
${!hasFocusAreas ? '- Ensure that topics are broad concepts within the source text that the question touches on.' : ''}`;

const getQuestionFormats = (
  questionType: QuestionType,
  difficulty: DifficultyType,
): string => {
  // For easy questions, use the simplified formats regardless of question type
  if (
    difficulty === 'easy' &&
    questionType !== 'Flash Cards' &&
    questionType !== 'Oral (Viva)' &&
    questionType !== 'Multiple True-False'
  ) {
    return getEasyQuestionFormats();
  }

  // Otherwise use the standard formats
  switch (questionType) {
    case 'Flash Cards':
      return '"What is...", "Define...", "Name...", "Identify..."';
    case 'Multiple True-False':
      return '"Which of the following statements are true regarding...?", "Evaluate the following statements about..."';
    case 'Oral (Viva)':
      return `"Explain the term...", "Define the term...", "What does it mean to..."`;
    default:
      return `"Which of the following best encapsulates the multifaceted dynamics of...?", "How does the interplay between X and Y fundamentally alter our understanding of Z?", "What are the intricate implications of... when examined through multiple lenses?", "Dissect the critical components that differentiate... in advanced contexts.", "Identify the underlying principles that drive... considering its layered complexity.", "To what extent do the following factors interact to influence...?"`;
  }
};

const getOptionInstructions = (questionType: QuestionType): string => {
  switch (questionType) {
    case 'Flash Cards':
      return 'For flashcards, include only one correct answer as the first option, and leave the other options empty';
    case 'Multiple True-False':
      return 'For each option, determine if it is true or false based on the source text content';
    case 'Oral (Viva)':
      return 'Leave the options empty';
    default:
      return 'Include one correct answer; vary its position';
  }
};

const getExplanationInstructions = (questionType: QuestionType): string => {
  switch (questionType) {
    case 'Flash Cards':
      return 'Explain why the answer is correct and provide context';
    case 'Multiple True-False':
      return 'Explain why each option is true or false';
    default:
      return 'Explain why the correct option is the answer and why the incorrect options are not';
  }
};

const getBaseQuestionInstructions = (questionType: QuestionType): string => `
For each question:
1. Ensure relevance to source text content
2. Provide 4 options with unique IDs${questionType === 'Flash Cards' ? ', with the correct answer as the first option' : ''}
3. ${getOptionInstructions(questionType)}
4. ${getAnswerFormatInstructions(questionType)}
5. Add a hint that aids recall without revealing the answer
6. Include a detailed explanation. ${getExplanationInstructions(questionType)}
7. Ensure the questions and options are ${questionType === 'Flash Cards' ? 'clear, concise, and promote effective memorization' : 'thought provoking'};`;

const getAnswerFormatInstructions = (questionType: QuestionType): string => {
  switch (questionType) {
    case 'Flash Cards':
      return 'Focus on strengthening memorization of key facts, terms, or concepts';
    case 'Multiple True-False':
      return 'Ensure a RANDOM mix of true and false statements - avoid ANY patterns in true/false distribution';
    default:
      return 'Create plausible but clearly incorrect alternatives';
  }
};

const getCaseStudyPrompt = (): string => `
IMPORTANT: Create questions based on realistic scenarios that apply the concepts from the source text. These case studies must be extremely challenging and require deep, multi-step reasoning, even for seasoned professors.

- For medical materials:
  - Begin each question with a concise yet detailed patient case or clinical situation.
  - Include critical details such as patient demographics, presenting symptoms, vital signs, laboratory or imaging results, and relevant medical history.
  - Ensure the scenario reflects real clinical complexity and mirrors challenges encountered in actual patient care.
  - Frame the question to test advanced clinical reasoning, differential diagnosis, treatment planning, or interpretation of diagnostic data.

- For non-medical materials:
  - Develop realistic scenarios or case studies that are directly relevant to the source text's subject matter.
  - Incorporate practical examples, contextual data, or situation-specific details that ground the scenario in real-world applications.
  - Frame the question to test application of knowledge, critical analysis, and decision-making in a manner that reflects genuine challenges in the field.

- In all cases:
  - Vary the types of scenarios (e.g., for medical: diagnosis, treatment planning, interpretation of results; for non-medical: strategic decision making, process analysis, problem-solving).
  - Ensure that answering the question demands an integrated understanding of the source text's content and the ability to synthesize multiple layers of information.
  - Avoid overly simplistic or rare scenarios; every case study must be sufficiently complex to force deep reasoning.

${CORRECT_ANSWER_DISTRIBUTION}
THIS INSTRUCTION IS CRITICAL FOR ALL QUESTIONS - STRICTLY ADHERE TO CREATING SCENARIO-BASED QUESTIONS THAT APPLY SOURCE TEXT CONCEPTS.
`;

const getDirectQuestionPrompt = (
  questionType: QuestionType,
  difficulty: DifficultyType,
): string => `
CRITICAL INSTRUCTIONS:  
- Generate ONLY direct, concept-driven questions that ${difficulty === 'easy' ? 'test basic recall and simple understanding' : 'demand advanced reasoning, deep understanding, and synthesis of knowledge'}.  
- Questions should ${difficulty === 'easy' ? 'focus on simple memorization and basic recall' : '**not** rely on simple recall but instead require complex thinking'}.  

### Format Examples  
${getQuestionFormats(questionType, difficulty)}

${getDirectQuestionDifficulty(difficulty)}  
`;

const getDirectQuestionDifficulty = (difficulty: DifficultyType) => {
  if (difficulty === 'hard')
    return `
  \n \n 
### Hard Difficulty Requirements
- Questions must require multi-step reasoning and integration of multiple concepts
- Include questions that test edge cases and exceptions to general rules
- Require application of concepts in novel or complex scenarios
- Ask about subtle distinctions between related concepts
- Include distractors that are very plausible and require deep understanding to eliminate

\n \n
### Example [THIS IS ONLY AN EXAMPLE AND YOU MUST ONLY USE IT AS A GUIDE IN GENERATING THE APPROPRIATE STYLE OF QUESTIONS. DO NOT GENERATE QUESTIONS FROM THIS, ONLY USE IT AS A GUIDE]
Instead of:  
❌ "What is Newton's First Law?"  
It will generate:  
✅ "A stationary object on Earth's surface doesn't appear to move relative to the planet despite Earth's rotation and orbital motion. Explain this apparent contradiction to Newton's First Law using the most precise physical framework."

\n
\n
- Introduce **counterintuitive** answer choices that challenge common misconceptions  
- Force respondents to **compare and contrast** subtly different concepts  
- Use questions that require synthesizing information from different parts of the source text
- Questions should demand **extended analytical reasoning**`;

  if (difficulty === 'medium')
    return `
   \n \n  
### Medium Difficulty Requirements
- Questions should require understanding and application, not just recall
- Test ability to distinguish between related concepts
- Require some analysis but not extensive multi-step reasoning
- Include plausible but incorrect options that test for common misconceptions

\n\n
### Example [THIS IS ONLY AN EXAMPLE AND YOU MUST ONLY USE IT AS A GUIDE IN GENERATING THE APPROPRIATE STYLE OF QUESTIONS. DO NOT GENERATE QUESTIONS FROM THIS, ONLY USE IT AS A GUIDE]
Instead of:  
❌ "What happens to a moving object if nothing pushes or pulls on it?"  
It will generate:  
✅ "According to Newton's First Law, what happens to a moving object in deep space compared to one moving on Earth's surface?"  

STRICT REQUIREMENT:  
- Questions should be challenging but straightforward for someone who understands the material
- Distractors should be plausible but distinguishable with proper understanding
- Questions should require application of concepts, not just definition recall`;

  return `
   \n  \n 
### EXTREMELY EASY Difficulty Requirements
- Focus ONLY on the most basic recall and simple definitions
- Use the SHORTEST possible questions - ideally under 10 words
- Keep answer options EXTREMELY brief - ideally 1-5 words each
- Test ONLY the most fundamental terms and concepts
- Make the correct answer OBVIOUS to anyone who has read the material once

\n\n
### Examples  [THIS IS ONLY AN EXAMPLE AND YOU MUST ONLY USE IT AS A GUIDE IN GENERATING THE APPROPRIATE STYLE OF QUESTIONS. DO NOT GENERATE QUESTIONS FROM THIS, ONLY USE IT AS A GUIDE]
CORRECT EASY QUESTIONS:
✅ "What is DNA?"
✅ "When was World War II?"
✅ "What is photosynthesis?"
✅ "What does CPU stand for?"
✅ "What is the definition of mitosis?"

\n
INCORRECT (TOO COMPLEX) QUESTIONS:
❌ "What does Newton's First Law state about objects in motion?"
❌ "How are proteins synthesized in the cell?"

STRICT REQUIREMENTS:  
- Questions MUST be extremely brief and direct
- Questions should NEVER require any analysis or comparison
- Correct answers should be clearly stated in the source text
- Distractors should be OBVIOUSLY wrong
- Focus exclusively on MEMORIZED facts, definitions, and terms
- Create questions that can be answered in 5 seconds or less
- Questions should be suitable for absolute beginners
`;
};

const getFlashCardPrompt = (difficulty: DifficultyType): string => `
IMPORTANT: For flashcard questions, adhere to these critical guidelines:

1. ANSWERS MUST BE EXTREMELY CONCISE - typically single words, short phrases, or brief definitions
2. Questions should be direct and clearly ask for a specific term, definition, or fact
3. The primary purpose is rapid recall and memorization
4. Place the correct answer as the first option, and leave all other options empty [CRITICAL]
 
${getFlashCardDifficultyLevel(difficulty)}

Example proper flashcard formats:
- "What is the term for the tendency of an object to resist changes in motion?" → "Inertia"
- "Define photosynthesis" → "Process by which plants convert light energy into chemical energy"
- "What year did World War II end?" → "1945" 
- "What is the capital of France?" → "Paris"
- "What hormone regulates blood glucose levels?" → "Insulin"

\n
[THIS IS ONLY AN EXAMPLE AND YOU MUST ONLY USE IT AS A GUIDE IN GENERATING THE APPROPRIATE STYLE OF QUESTIONS. DO NOT GENERATE QUESTIONS FROM THIS, ONLY USE IT AS A GUIDE]
DO NOT create complex questions like:
❌ "Considering the multifaceted implications of cellular metabolism, what is the precise definition of glycolysis?"
✅ Instead use: "What is glycolysis?"

${CRITICAL_DIVERSITY_INSTRUCTIONS}
`;

// Helper function for flash card difficulty levels
const getFlashCardDifficultyLevel = (difficulty: DifficultyType): string => {
  if (difficulty === 'hard')
    return `
FOR HARD DIFFICULTY FLASH CARDS:
- Test advanced terminology and specific technical definitions
- Include numerical values, specific years, or exact formulas where appropriate
- Focus on specialized subconcepts rather than general terms
- Test distinctions between closely related terms
- Answers should still be concise but may include precise technical language

Examples:
- "What is the Henderson-Hasselbalch equation?" → "pH = pKa + log([A-]/[HA])"
- "Define bradykinesia" → "Abnormal slowness of movement"
- "What specific enzyme catalyzes the first step of glycolysis?" → "Hexokinase"`;

  if (difficulty === 'medium')
    return `
FOR MEDIUM DIFFICULTY FLASH CARDS:
- Focus on important terms, processes, and concepts
- Test understanding of relationships between concepts
- Include questions about key functions and mechanisms
- Answers should be concise but complete
- Test application of terms in context

Examples:
- "What is the function of mitochondria?" → "Cellular energy production (ATP synthesis)"
- "Define osmosis" → "Movement of water across a semipermeable membrane"
- "What is a cytokine?" → "Signaling protein that regulates immune response"`;

  return `
FOR EXTREMELY EASY FLASH CARDS:
- Focus EXCLUSIVELY on simple term-definition pairs
- Questions should be 3-7 words maximum
- Answers should be 1-5 words maximum when possible
- Use the simplest possible language
- Test ONLY the most basic terms from the source text

Examples:
- "What is DNA?" → "Deoxyribonucleic acid"
- "Define cell" → "Basic unit of life"
- "What is metabolism?" → "Chemical processes in organisms"
- "What is a neuron?" → "Nerve cell"
- "Define atom" → "Smallest unit of matter"

CRITICAL: Flash cards must be EXTREMELY basic and should NEVER require any reasoning or analysis.`;
};

const getOralQuestionPrompt = (): string => `
INSTRUCTIONS:
Generate straightforward oral examination questions that test understanding through clear explanation.
Questions should be:
- Brief (one line only)
- Direct and clear
- Focused on explanation or description
- Easy to understand but still testing comprehension

Questions should ask students to:
- Explain key concepts in their own words
- Describe processes or principles
- Outline important relationships
- Summarize main ideas

Example Transformations:
❌ Instead of:
"Why does entropy increase in a system, yet order still emerges in nature?"

✅ Ask:
"Explain what entropy is and why it matters."

❌ Instead of:
"Why do some reinforcements fail to change behavior?"

✅ Ask:
"Describe how reinforcement affects behavior in psychology."

REQUIREMENTS:
- Keep questions to one line
- Focus on explanation rather than complex analysis
- Use clear language the student can immediately understand
- Begin with words like "Explain," "Describe," "Outline," or "Summarize"
`;

const getMultipleTrueFalsePrompt = (): string => `
CRITICAL: For Multiple True-False questions, adhere to these guidelines:

EXTREMELY IMPORTANT - TRUE/FALSE DISTRIBUTION:
- The distribution of true and false answers MUST be completely random.
- Consciously avoid ANY patterns in the true/false distribution.
- Each new question's true/false pattern should be entirely independent of other questions.
- Treat each option's true/false value as an independent decision.
- Do NOT try to "balance" the number of true and false statements across questions.
- Options can be all true, all false, or any random combination.
- Double-check your question set to ensure no accidental patterns have emerged.

${STATEMENT_CREATION_GUIDELINES}

Example of correct formatting and randomization:

Question: "Regarding cellular stress responses and protein regulation:"
Options:
value: "While heat shock proteins are upregulated during thermal stress, their protective effects extend beyond temperature-related protein denaturation" (id: "A", answer: true)
value: "The ubiquitin-proteasome system exclusively targets misfolded proteins for degradation, making it the primary quality control mechanism in cells" (id: "B", answer: false)
value: "Cellular proteostasis networks become permanently impaired following acute oxidative stress, leading to irreversible protein aggregation" (id: "C", answer: false)
value: "The unfolded protein response can paradoxically increase protein synthesis in specific cellular compartments while globally attenuating translation" (id: "D", answer: true)

Note how:
1. Option values contain ONLY the statement text, without any option ID prefixes.
2. The IDs (A, B, C, D) are separate from the statements.
3. The true/false pattern (TFFT) is unique and doesn't follow any predictable sequence.
4. Each subsequent question must have its own independent, random pattern.

THIS INSTRUCTION IS CRITICAL FOR MULTIPLE TRUE-FALSE QUESTIONS:
1. ABSOLUTELY NO PATTERNS IN TRUE/FALSE DISTRIBUTION.
2. EACH QUESTION'S TRUE/FALSE PATTERN MUST BE INDEPENDENT AND RANDOM.
3. ENSURE FALSE STATEMENTS ARE CREATED BY MAKING SUBTLE, MEANINGFUL CHANGES TO TRUE STATEMENTS FROM THE SOURCE TEXT.
4. DO NOT INCLUDE OPTION IDs (A, B, C, D) IN THE OPTION VALUES - KEEP THEM SEPARATE IN THE ID FIELD.
`;

const getDifficultyPrompt = (difficulty: DifficultyType = 'medium') => {
  if (difficulty === 'hard') {
    return `
    \n ### Key Enhancements for Difficulty - HARD LEVEL
    [EXTREMELY IMPORTANT FOR DIFFICULTY LEVEL] 
    
    EVERY QUESTION MUST BE GENUINELY CHALLENGING, EVEN FOR SUBJECT MATTER EXPERTS:
    
    1. Design questions that require integrating multiple concepts from different parts of the source text
    2. Create distractors that are partially correct but contain subtle flaws
    3. Test edge cases and exceptions to general principles
    4. Require multi-step reasoning to arrive at the correct answer
    5. Include answer options that represent common misconceptions or oversimplifications
    6. Test the application of concepts in novel or complex scenarios
    7. Ask about implications, consequences, or relationships rather than direct facts
    8. Require precise understanding of technical definitions and their boundaries
    
    The questions should make even a professor pause and think carefully before answering.
    `;
  }

  if (difficulty === 'medium') {
    return `
    \n ### Key Enhancements for Difficulty - MEDIUM LEVEL
    [EXTREMELY IMPORTANT FOR DIFFICULTY LEVEL]
    
    QUESTIONS SHOULD BE MODERATELY CHALLENGING BUT APPROACHABLE:
    
    1. Test understanding and application, not just recall
    2. Require some analysis but not extensive multi-step reasoning
    3. Include plausible distractors that test for common misconceptions
    4. Focus on important principles and their typical applications
    5. Test ability to distinguish between related concepts
    6. Questions should be challenging but straightforward for someone who understands the material
    7. Distractors should be clearly wrong to someone who understands the concepts well
    
    The questions should require thought but be answerable by someone who has studied the material well.
    `;
  }

  return `
  \n ### Key Enhancements for Difficulty - EXTREMELY EASY LEVEL
  [EXTREMELY IMPORTANT FOR DIFFICULTY LEVEL]
  
  QUESTIONS MUST BE EXTREMELY BASIC AND STRAIGHTFORWARD:
  
  1. USE EXTREMELY SHORT QUESTIONS - ideally under 10 words
  2. USE EXTREMELY SHORT ANSWER OPTIONS - ideally 1-5 words each
  3. TEST ONLY THE MOST BASIC FACTS AND DEFINITIONS
  4. MAKE THE CORRECT ANSWER OBVIOUS to anyone who has glanced at the material
  5. USE THE SIMPLEST POSSIBLE LANGUAGE - avoid all technical terms in the question itself
  6. FOCUS ONLY ON DIRECT STATEMENTS from the source text - never require inference
  7. DISTRACTORS SHOULD BE OBVIOUSLY INCORRECT - no tricky or close options
  
  EXAMPLES OF PROPER EASY QUESTIONS:
  ✅ "What is a cell?"
  ✅ "Which element is represented by H?"
  ✅ "What does DNA stand for?"
  ✅ "Which organ pumps blood?"
  
  REMEMBER: These questions must be answerable within 3-5 seconds by absolute beginners.
  `;
};

const getQuestionStyle = (questionType: QuestionType) => {
  if (questionType === 'Flash Cards') return 'flashcard-style';

  if (questionType === 'Multiple Choice') return 'multiple-choice';

  if (questionType === 'Multiple True-False') return 'multiple true-false';

  if (questionType === 'Oral (Viva)') return 'oral (viva)';
};

const getBasePrompt = (
  sourceText: string,
  questionCount: number,
  focusAreas?: string[],
  questionType?: QuestionType,
  difficultyLevel?: DifficultyType,
): string => `
Analyze the source text, BETWEEN SOURCE TEXT START AND SOURCE TEXT END, below very thoroughly. Generate ${questionCount} unique and new ${getQuestionStyle(
  questionType,
)} questions based on key concepts. ${questionType === 'Oral (Viva)' ? VIVADIFFICULTYPROMPT : getDifficultyPrompt(difficultyLevel)}. QUESTIONS CONTENT SHOULD ONLY BE BASED ON THE SOURCE TEXT!!!

\n\n
**SOURCE TEXT START**
${sourceText}
**SOURCE TEXT END**
\n\n

${
  focusAreas?.length
    ? `Focus specifically on these concepts: ${focusAreas.join(', ')}. Create specific, concept-focused questions that test core understanding. Distribute questions evenly across concepts and shuffle their order. QUESTIONS SHOULD SOLELY BE BASED ON THESE CONCEPTS, NO OTHER AREAS WITHIN THE SOURCE TEXT.`
    : 'Consider the different concepts the source text taught within the source text and distribute questions evenly across these concepts. Consider concepts not explored in previous questions'
}

${
  !['Flash Cards', 'Oral (Viva)'].includes(questionType)
    ? 'AGAIN, ENSURE THE QUESTIONS AND OPTIONS ARE AT THE HIGHEST DIFFICULTY POSSIBLE. THE OPTIONS SHOULD INCLUDE DISTRACTORS THAT REQUIRE DEEP UNDERSTANDING TO RULE OUT. THE QUESTIONS SHOULD REQUIRE THE READER TO UNDERGO MULTISTEP REASONING AND CRITICAL THINKING.'
    : ''
}

${
  !focusAreas?.length
    ? 'Ensure questions are not repetitive, explore the source text extensively and produce questions from different areas within the source text. DO NOT FOCUS QUESTIONS ON A SMALL AREA. EXPLORE THE WHOLE SOURCE TEXT AND GIVE QUESTIONS FROM DIFFERENT AREAS WITHIN THE SOURCE TEXT.'
    : ''
}

${getTopicTaggingInstructions(!!focusAreas?.length)}

${getBaseQuestionInstructions(questionType)}`;

const getJsonFormat = (questionType: QuestionType): string => {
  const baseFormat = `[
  {
    "id": "string",
    "question": "string",
    "options": [`;

  if (questionType === 'Oral (Viva)') {
    return `[
  {
    "id": "string",
    "question": "string",
    "options": [], // THIS WILL HAVE A LENGTH OF 0. NO OPTIONS SHOULD BE WITHIN AND SHOULD BE LEFT EMPTY 
    "explanation": "string",
    "hint": "string",
    "topic": "string"
  }
]`;
  }

  if (questionType === 'Flash Cards') {
    return `${baseFormat}
      { "value": "string", "id": "string" }  
    ] // THIS WILL HAVE A LENGTH OF ONLY 1 AND THAT ONE OBJECT WILL HOLD THE CORRECT INFORMATION TO THE QUESTION. JUST ONE OBJECT WITH THE RIGHT OPTION!!! VERY IMPORTANT,
    "explanation": "string",
    "hint": "string",
    "topic": "string"
  }
]`;
  }

  return `${baseFormat}
      ${
        questionType === 'Multiple True-False'
          ? '{ "value": "string", "id": "string", "answer": boolean }'
          : '{ "value": "string", "id": "string" }'
      }
    ],
    ${questionType !== 'Multiple True-False' ? '"correctAnswerId": "string",' : ''}
    "explanation": "string",
    "hint": "string",
    "topic": "string"
  }
]`;
};

const getFormatRules = (questionType: QuestionType): string => `
IMPORTANT FORMAT RULES:
1. For each question, the options' IDs should be A, B, C, or D consecutively
2. The option "value" field should contain ONLY the statement text, without any option ID prefixes
3. Ensure EVERY question is tagged with a topic. THIS IS VERY IMPORTANT AND NON-NEGOTIABLE
${
  questionType === 'Multiple True-False'
    ? '4. For Multiple True-False questions:\n   - Include the "answer" field for each option, set to either true or false\n   - Keep the true/false distribution COMPLETELY RANDOM with NO PATTERNS\n   - DO NOT include option IDs (A, B, C, D) in the option values. A QUESTION MAY CONTAIN MULTIPLE TRUE STATEMENTS AND MULTIPLE FALSE STATEMENTS. IT DOES NOT HAVE TO CONTAIN ONLY ONE TRUE STATEMENT'
    : ''
}`;

export const getAnswerVariationRule = (questionType: QuestionType) => {
  if (questionType === 'Flash Cards') {
    return '\nIMPORTANT FOR FORMAT: Ensure there is only one correct answer for each question';
  }

  if (questionType === 'Multiple Choice') {
    return `
    CRITICAL - PREVENT PATTERNS: 
    - Randomize the position of the correct answer (A, B, C, D) for EACH question.
    - NEVER favor any particular option position.
    - Track your assigned correct answers to ensure they follow NO discernible pattern.
    - Each correct answer position should be determined randomly and independently.
    - Ensure that over a set of questions, the correct answers are evenly distributed across all options.
    `;
  }

  if (questionType === 'Multiple True-False') {
    return 'CRITICAL - PREVENT PATTERNS: For each Multiple True-False question, you MUST randomize the true/false values with NO discernible pattern. DO NOT use "true false true false" or any other repeating sequence. Each statement\'s truth value must be determined independently and randomly. Some questions may have all true statements, some all false, some mixed randomly. The distribution MUST be completely unpredictable. THIS IS ABSOLUTELY ESSENTIAL.';
  }

  return '';
};

const getPreviousQuestionsToAvoid = (prevQuestions: string[]) => {
  if (!prevQuestions.length) return '';

  return `
    \n\n
NOTE: DO NOT REPEAT QUESTIONS. FORMULATE NEW AND ACCURATE QUESTIONS AND OPTIONS
\n
Here is a list of questions you have generated before, generate new ones. LOOK FOR NEW WAYS TO FRAME QUESTIONS. DO NOT REPEAT THESE SAME PATTERNS!
\n
${prevQuestions}
    `;
};

const CORRECT_ANSWER_DISTRIBUTION = `
CRITICAL - PREVENT ANSWER PATTERNS: 
1. For Multiple Choice questions:
   - Randomize the position of the correct answer (A, B, C, D) for EACH question
   - NEVER favor any particular option position
   - Track your assigned correct answers to ensure they follow NO discernible pattern
   - Each correct answer position should be determined randomly and independently

2. For Multiple True-False questions:
   - Randomize the true/false values for EACH statement with NO discernible pattern
   - DO NOT use "true false true false" or any other repeating sequence
   - Each statement's truth value must be determined independently and randomly
   - Some questions may have all true statements, some all false, some mixed randomly

THIS IS ABSOLUTELY ESSENTIAL - The distribution of correct answers must be completely unpredictable. Students must not be able to detect any pattern whatsoever in the positioning of correct answers.`;

// Main generator function
export const generatePromptForQuestionsV2 = ({
    questionCount = 5,
    sourceText,
    focusAreas,
    includeCaseStudies = false,
    questionType = 'Multiple Choice',
    difficulty,
    previousQuestions,
  }: PromptConfigV2): string => {
    const basePrompt = getBasePrompt(
      sourceText,
      questionCount,
      focusAreas,
      questionType,
    );
    const specificPrompt = getSpecificPrompt(
      questionType,
      includeCaseStudies,
      difficulty,
    );
    const formatRules = getFormatRules(questionType);
    const previousQuestionsToAvoid =
      getPreviousQuestionsToAvoid(previousQuestions);
    const patternAvoidance = getAnswerVariationRule(questionType);
  
    return `
    ${patternAvoidance}
    ${formatRules}
  ${basePrompt}
  ${specificPrompt}
  
  ${previousQuestionsToAvoid}
  `;
};

export const generateOralExaminationPrompt = (questions: string[]): string => {
  let questionsToAsk = questions.map((q, i) => `${i + 1}. ${q}`).join('\n');

  return `

You are an AI oral examiner conducting an interactive and engaging oral exam for a student.

IMPORTANT - YOU MUST LET THE STUDENT KNOW AT THE START OF THE CALL THAT THEY HAVE A TOTAL OF ${questions.length} QUESTIONS TO ANSWER
AND THAT THEY HAVE A MAX OF 30 SECONDS FOR EACH QUESTION SO THEIR RESPONSE SHOULD BE SHORT AND STRAIGHT TO THE POINT. IF NEED BE, LET THEM KNOW THAT THE EXAMINATION WOULD END SOON AND AN ASSESSMENT WOULD BE PROVIDED. TRY TO NOT INDULGE IN QUESTIONS NOT RELATING DIRECTLY TO THE EXAM. RESPOND IN A HUMAN LIKE MANNER, RESPOND TO GREETINGS BUT BE PROFESSIONAL AND TIME CONSCIOUS. ONCE THE ASSESSMENT IS OVER, YOU CAN GO AHEAD AND END THE CALL. LET THEM KNOW YOU WOULD BE ENDING THE CALL BEFORE DOING SO.

[YOUR GOAL]

Your goal is to ask questions clearly and patiently, ensuring the student has enough time to think before responding. You should be friendly, encouraging, and professional while maintaining the integrity of the examination.

Here’s how you should conduct the exam:

- Greet the student warmly and set a relaxed tone.
- Read each question slowly and clearly, giving the student time to process before moving on.
- If the student asks for clarification, politely repeat the question but do not explain or provide hints.
- If the student asks for an answer, kindly state that you cannot provide answers and encourage them to try their best.
- Wait for the student’s response before proceeding to the next question.
- Maintain a friendly and professional tone throughout the session.
- Keep responses short and conversational—no long speeches.
- Use a warm and encouraging tone, making the student feel comfortable.
- If a student asks questions about the exam or source text, politely say you cannot answer and encourage them to focus on their response.

Example Interaction:

**AI:** "Hey there! Ready for your oral exam? Take a deep breath—you got this! Here’s your first question."

**AI:** "In the context of neonatal sepsis, how does the definition of 'confirmed sepsis' differ from 'severe sepsis,' and what implications do these distinctions have for treatment?"

(Wait for response.)

**Student:** "Could you explain what you mean by implications?"  
**AI:** "I can’t explain that, but feel free to answer in a way that makes sense to you!"  

**Student:** [Answers]  

**AI:** "Great! Let’s move on." (Proceeds to next question.)  

Here are the questions you are to ask the user:

**QUESTIONS TO ASK**
${questionsToAsk}

**IMPORTANT - READ THE QUESTIONS VERY SLOWLY. DO NOT RUSH.**  

At the end of the assessment, let the user know that their response will be graded and they will be notified accordingly.

  `;
};

// Continued helper functions
const getSpecificPrompt = (
  questionType: QuestionType,
  includeCaseStudies: boolean,
  difficulty: DifficultyType,
): string => {
  if (questionType === 'Flash Cards') return getFlashCardPrompt(difficulty);
  if (questionType === 'Multiple True-False')
    return getMultipleTrueFalsePrompt();
  if (questionType === 'Oral (Viva)') return getOralQuestionPrompt();
  return includeCaseStudies
    ? getCaseStudyPrompt()
    : getDirectQuestionPrompt(questionType, difficulty);
};

const getEasyQuestionFormats = (): string => `
"What is...?", 
"Define...", 
"Who discovered...?", 
"When did...?", 
"Where is...?", 
"Which of these is...?"
`;

export const getOralExaminationTranscriptAnalysisPrompt = (
  transcript: string,
): string => {
  return `
  # Oral Examination Analysis Task

  ## Instructions:
  1. First, thoroughly review the reference source text attached to this conversation thread. This source text contains the authoritative information against which you must evaluate all student answers.
  
  2. Identify only the academic test questions in the transcript below (ignore greetings, small talk, and closing remarks).
  
  3. For each identified question:
     - Determine the expected correct answer based EXCLUSIVELY on the attached reference source text
     - Extract the student's actual response from the transcript
     - Perform a rigorous comparison between the student's answer and the information in the attached source text
     - Craft a detailed, evidence-based analysis with direct quotations from the reference source text when relevant
  
  4. Apply strict scoring criteria (0-10) based on accuracy, completeness, and precision in relation to the reference source text.

  ## System Analysis Requirements:
  - Address the student directly using "you" and "your" (e.g., "You demonstrated good understanding of...")
  - Begin with positive observations about what the student did correctly
  - Follow with specific areas for improvement, citing exact information from the reference source text
  - Include direct quotes from the reference source text to support your analysis
  - Be encouraging but honest about shortcomings
  - Provide concrete suggestions for improvement
  - Keep the overall tone supportive while maintaining evaluative rigor
  - Be thorough in your analysis but avoid unnecessary length
  
  ## Scoring Guidelines:
  - Apply strict standards when scoring
  - Perfect scores (10/10) should be rare and only given for answers that align perfectly with the reference source text
  - Deduct points for any omissions, inaccuracies, or imprecise statements
  - Consider both factual correctness and completeness in relation to the reference material
  - A score of 7/10 should represent a good answer with minor omissions
  - Scores below 5 indicate significant gaps or misunderstandings

  ## Required Output Format:
  Return ONLY a JSON array with this exact structure:
  [
    {
      "question": "The exact question as asked in the transcript",
      "userResponse": "The student's answer (or 'no-answer' if they failed to respond)",
      "systemAnalysis": "Your detailed, evidence-based analysis speaking directly to the student, with specific references to the attached source text",
      "score": number (between 0-10, applying strict standards)
    }
  ]

  Important rules:
  - Base all evaluations EXCLUSIVELY on the attached reference source text
  - Include ONLY academic test questions in your analysis
  - Use "no-answer" (lowercase, hyphenated) when the student doesn't provide a substantive response
  - Ensure your analysis is specific, evidence-based. DO NOT CITE SOURCES.
  - Ensure that the userResponse is filtered and does not contain fillers like "um". It should be close to verbatim but refined.
  - Maintain an encouraging tone while being honest about shortcomings
  - Apply strict scoring standards
  - Ensure the output is valid JSON with the exact structure specified above

  ## Transcript to Analyze:
  ${transcript}
  `;
};
