import { QuestionType } from 'src/infra/web/models/QuestionTypeModel';

export interface PromptConfigV2 {
  questionCount: number;
  sourceText: string;
  focusAreas?: string[];
  previousQuestions: string[];
  includeCaseStudies: boolean;
  questionType: QuestionType;
  difficulty: DifficultyType;
  preferredLanguage: string;
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

const getBaseQuestionInstructions = (questionType: QuestionType): string => {
  if (questionType === 'Flash Cards') {
    return `
For each flashcard:
1. Ensure relevance to source text content
2. Provide a single answer option with a unique ID
3. ${getOptionInstructions(questionType)}
4. ${getAnswerFormatInstructions(questionType)}
5. Add a hint that aids recall without revealing the answer
6. Include a detailed explanation. ${getExplanationInstructions(questionType)}
7. Ensure the questions follow Anki-style formatting and that both the question and single answer option are clear, concise, and promote effective memorization`;
  }

  return `
For each question:
1. Ensure relevance to source text content
2. Provide 4 options with unique IDs
3. ${getOptionInstructions(questionType)}
4. ${getAnswerFormatInstructions(questionType)}
5. Add a hint that aids recall without revealing the answer
6. Include a detailed explanation. ${getExplanationInstructions(questionType)}
7. Ensure the questions and options are thought-provoking`;
};

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
IMPORTANT: These must be pure Anki‑style flashcards—question on one side, single concise answer on the back. Do NOT generate multiple‑choice or “which of the following” questions.

1. QUESTIONS must be direct prompts for a single fact, term, date, definition, or concept.
2. ANSWERS must be extremely concise—single words, short phrases, or brief definitions.
3. Focus on rapid recall and memorization; avoid any extraneous wording.
4. Do NOT include distractor options—only the question and its correct answer.
5. Format exactly like Anki cards:  
   Q: "…"  
   A: "…"

${getFlashCardDifficultyLevel(difficulty)}

—  
**Good examples**  
Q: "What year did World War II end?"  
A: "1945"

Q: "Define photosynthesis"  
A: "Process by which plants convert light energy into chemical energy"

—  
**Bad examples** (must avoid)  
• "Which of the following is a major risk factor for pulmonary embolism?"  
• "Considering the multifaceted implications of cellular metabolism, what is the precise definition of glycolysis?"  

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

const getEssayQuestionPrompt = (
  difficulty: DifficultyType,
  includeCaseStudies: boolean,
): string => `
INSTRUCTIONS:
Generate well-structured, essay-style questions that require students to develop thoughtful, multi-paragraph responses. Questions should assess understanding, application, and reasoning, appropriate to the ${difficulty} difficulty level${includeCaseStudies ? ' and based on realistic case scenarios' : ''}.

DIFFICULTY LEVEL: ${difficulty.toUpperCase()}
${
  difficulty === 'easy'
    ? `- Emphasize explanation and description of key ideas
- Ask students to identify, describe, and explain basic concepts or processes
- Require clarity in exposition over complex reasoning
- Suitable for foundational or introductory learners`
    : difficulty === 'medium'
      ? `- Combine explanation with moderate analysis and application
- Ask students to compare, apply, or explore cause-effect relationships
- Require connection of theory to real-world or hypothetical examples
- Suitable for intermediate learners`
      : `- Emphasize critical evaluation, synthesis, and theory integration
- Ask students to assess, critique, or develop original arguments
- Require depth of reasoning and evidence-based judgment
- Suitable for advanced or expert learners`
}

${
  includeCaseStudies
    ? `CASE STUDY APPROACH:
- Infer the appropriate domain from the source (e.g., medical, legal, educational, etc.)
- Present a realistic scenario with sufficient context
- Design questions that ask students to explain, describe, or discuss theoretical principles in response to the situation
- Encourage application of knowledge, professional reasoning, and analysis of implications
- Match the complexity of the case to the selected difficulty level

EXAMPLES OF DOMAIN-BASED SCENARIOS:
- MEDICAL: A patient with specific symptoms, medical history, and treatment considerations
- LEGAL: A dispute or ethical dilemma with legal implications
- BUSINESS: A company facing strategic, operational, or financial challenges
- EDUCATION: A classroom issue or curriculum design scenario
- POLICY: A government considering responses to a social or political issue
- ENGINEERING: A technical design or failure scenario requiring evaluation
- SOCIAL WORK: A client or community in need of intervention

`
    : ''
}

QUESTION REQUIREMENTS:
- Prompt multi-paragraph responses that demonstrate structured thinking
- Use verbs such as "explain," "describe," "discuss," "analyze," "evaluate," and "develop"
- Tailor complexity to the ${difficulty} level
${includeCaseStudies ? '- Frame questions within realistic scenarios that require explanation and applied reasoning' : '- Provide enough direction to guide depth without a case narrative'}
- Require specific examples, evidence, or theoretical references

COGNITIVE TARGETS:
${
  difficulty === 'easy'
    ? `- UNDERSTAND: Explain key ideas clearly
- DESCRIBE: Identify and detail features of concepts
- ILLUSTRATE: Provide relevant examples to show understanding
- OUTLINE: Present a summary of processes or frameworks`
    : difficulty === 'medium'
      ? `- ANALYZE: Break down ideas and explore relationships
- COMPARE: Explore similarities and differences
- APPLY: Use knowledge to explore real-world relevance
- EXPLAIN CAUSES & EFFECTS: Link actions, principles, and outcomes`
      : `- EVALUATE: Make judgments based on arguments and evidence
- SYNTHESIZE: Combine ideas into original perspectives
- CRITIQUE: Assess and reflect on strengths and weaknesses
- DEVELOP: Construct arguments or frameworks with depth and nuance`
}
${
  includeCaseStudies
    ? `
- APPLY: Use theory to interpret or solve case problems
- JUSTIFY: Defend decisions or interpretations with reasoning
- DISCUSS: Consider perspectives and implications of actions`
    : ''
}

QUESTION FORMATS:
${
  includeCaseStudies
    ? difficulty === 'easy'
      ? `- "A patient presents with [symptoms]. Describe the likely diagnosis, explain the underlying mechanism, and outline initial treatment steps."
- "A teacher notices students struggling with a lesson. Explain possible causes of the difficulty and describe how the issue could be addressed."`
      : difficulty === 'medium'
        ? `- "A startup is expanding rapidly but facing operational delays. Analyze the situation, explain contributing factors, and discuss potential solutions."
- "A new education policy is being implemented across schools. Discuss its intended outcomes, identify possible obstacles, and explain ways to address them."`
        : `- "An engineering firm must choose between two competing designs. Critically evaluate each design’s merits and risks, and justify the preferred option."
- "A country is debating a law to regulate AI. Discuss the ethical and societal implications, evaluate opposing viewpoints, and propose a balanced approach."`
    : difficulty === 'easy'
      ? `- "Describe the role of mitochondria in cells and explain why they are called the powerhouses of the cell."
- "Explain the importance of regular exercise and describe its effects on physical health."`
      : difficulty === 'medium'
        ? `- "Compare and contrast socialism and capitalism, explaining their key differences and effects on economic equality."
- "Analyze how rainfall patterns affect crop yield, using examples from different regions."`
        : `- "Evaluate the effectiveness of international aid in conflict zones, and develop an argument for improving its impact."
- "Discuss how globalization affects cultural identity, referencing both benefits and challenges."`
}

EXAMPLE TRANSFORMATIONS:
${
  includeCaseStudies
    ? difficulty === 'easy'
      ? `❌ Instead of: "What are the symptoms of asthma?"
✅ Ask: "A 12-year-old child arrives at the clinic with wheezing and shortness of breath after exercise. Describe the likely condition, explain its causes, and outline initial management."`
      : difficulty === 'medium'
        ? `❌ Instead of: "What are the effects of pollution?"
✅ Ask: "A city reports rising respiratory illnesses linked to air pollution. Analyze the likely causes, discuss public health implications, and explain effective intervention strategies."`
        : `❌ Instead of: "What is a data breach?"
✅ Ask: "A company experiences a cyberattack that exposes customer data. Critically evaluate the organization’s response, discuss legal and ethical implications, and propose strategies for prevention."`
    : difficulty === 'easy'
      ? `❌ Instead of: "What is democracy?"
✅ Ask: "Describe the key principles of democracy and explain how they influence citizen participation."`
      : difficulty === 'medium'
        ? `❌ Instead of: "How does advertising affect behavior?"
✅ Ask: "Analyze the impact of persuasive advertising on consumer decisions and discuss its ethical implications."`
        : `❌ Instead of: "What is artificial intelligence?"
✅ Ask: "Evaluate the role of artificial intelligence in modern healthcare. Discuss its potential, limitations, and ethical considerations."`
}

FORMATTING GUIDELINES:
- Use clear, directive verbs suited to ${difficulty} level
${includeCaseStudies ? '- Begin with a realistic, domain-appropriate scenario\n- Follow with a prompt that asks students to explain, describe, or discuss concepts in context' : '- Provide structured prompts that guide scope, depth, and reasoning'}
- Ensure academic rigor while maintaining clarity and focus
- Questions should encourage depth of response proportional to ${difficulty} difficulty
`;

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
)} questions based on key concepts. ${questionType === 'Oral (Viva)' ? VIVADIFFICULTYPROMPT : getDifficultyPrompt(difficultyLevel)}. 

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

const getPreferredLanguagePrompt = (pl: string) => {
  if (pl.toLowerCase() === 'english') return '';

  return `VERY IMPORTANT. ENSURE YOU OUTPUT IN ${pl.toUpperCase()} LANGUAGE!!!`;
};

// Main generator function
export const generatePromptForQuestionsV2 = ({
  questionCount = 5,
  sourceText,
  focusAreas,
  includeCaseStudies = false,
  questionType = 'Multiple Choice',
  difficulty,
  previousQuestions,
  preferredLanguage = 'English',
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
  const preferredLanguagePrompt = getPreferredLanguagePrompt(preferredLanguage);

  return `
    ${patternAvoidance}
    ${formatRules}
  ${basePrompt}
  ${specificPrompt}
  
  ${previousQuestionsToAvoid}

  ${preferredLanguagePrompt}
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
  if (questionType === 'Essay')
    return getEssayQuestionPrompt(difficulty, includeCaseStudies);
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

export const generateTopicPromptV2 = (language = 'English') => {
  return `
Please review the document, and understand thoroughly what the document is about deeply and in detail. Then, determine if it is divided into detailed distinct topics, chapters or content covering various specific concepts in the document. Check if the broad concepts or chapters or topics are further broken down into specific concepts or topics. If it is, extract and return all the specific topics. If not, analyze the document, identify different specific concepts or topics, and return them. Ensure that they are detailed, touching on specific concepts and not a broad overview.

Output the result in the following JSON format:

["title1", "title2", ... ]

Provide only the JSON array, nothing else. Be detailed and fast. ENSURE THE TOPICS ARE IN ${language} LANGUAGE. TRANSLATE IF NEED BE.`;
};

export const generateTopicPromptV2_2 = (sourceText: string) => {
  return `
  Please review the source text below, and understand thoroughly what the document is about deeply and in detail. Then, determine if it is divided into detailed distinct topics, chapters or content covering various specific concepts in the source text. Check if the broad concepts or chapters or topics are further broken down into specific concepts or topics. If it is, extract and return all the specific topics. If not, analyze the source text, identify different specific concepts or topics, and return them. Ensure these topics are a broad overview of the sections covered within the source text, and not excessive and detailed. Broad concepts covered by sections.

  **SOUCE TEXT START**
  ${sourceText}
  **SOURCE TEXT END**
  `;
};

// export const generateGenericTopicsPrompt = (sourceText: string) => {
//   return `
//     Your job is to categorize the source text below into topics. Wholistically look at the source text and break it down into meaningful divisions. Think of yourself as someone writing the glossary for a textbook. Your job is to create this glossary for the below source text. The text might be from a lecture slide and so there may be pages where it might just be the name of the lecturer, you may just group sections like this into the introduction. Your job ultimately is to group the sections of the source text into meaningful topics. Analyze and determine where the source text might have originated from, then categorize it so we can use the information you provide to create a glossary for the text. The text itself might contain a glossary, this might be grouped under introduction as well. Your job is to come up with your own groupings to create a new and better glossary. Each topic should be unique, and for each, write a short one or two liner short description to give a little insight on what that topic might be about.

//     **SOUCE TEXT START**
//     ${sourceText}
//     **SOURCE TEXT END**
//   `;
// };

export const generateGenericTopicsPrompt = (sourceText: string) => {
  return `
    Your job is to categorize the source text below into topics for a comprehensive glossary. Think of yourself as creating chapter-level divisions for a textbook - not too broad to be meaningless, but not so granular that closely related concepts are unnecessarily separated.

    **GROUPING GUIDELINES:**
    - Group related subtopics under broader umbrella topics (e.g., "epidural infections," "subdural infections," and "nervous system infections" should all be grouped under "Infections")
    - Aim for 5-12 main topics total, depending on content length and complexity
    - Each topic should represent a distinct conceptual area that would warrant its own chapter or major section
    - Avoid creating separate topics for concepts that are variants, subtypes, or closely related aspects of the same broader theme
    - If the text covers administrative content (lecturer names, course info, etc.), group these under "Introduction" or "Course Information"
    - If the text contains an existing glossary, group it under "Reference Materials" rather than creating separate topics for each glossary entry

    **TOPIC SCOPE EXAMPLES:**
    - Good: "Cardiovascular Disorders" (covers heart disease, arrhythmias, blood pressure issues)
    - Too granular: "Myocardial Infarction," "Cardiac Arrhythmias," "Hypertension" as separate topics
    - Too broad: "Medical Conditions" (covers everything, not meaningful)

    Analyze the source text to understand its origin and purpose, then create a well-structured glossary with appropriately scoped topics. Each topic should have a unique name and a 1-2 sentence description explaining what that topic encompasses.

    **SOURCE TEXT START**
    ${sourceText}
    **SOURCE TEXT END**
  `;
};

export const generateTopicPromptV2_3 = (docsByPage: string[]) => {
  return `
  Below is an array os strings which originate from a single document. Each item in the array represents a page in the document.
  Your job is to look through the content, thoroughly understand it, then generate topics based on the page range. So, if the 
  first 5 items in the array cover the outline of the overall text, then group that into one topic, and so on.
  Do this with utmost precision as it is would be detrimental not to do so. Ensure topics are grouped correctly and based
  on your deep understanding of the overall text! 

  **DOCUMENT BY PAGES**
  ${docsByPage}
  **DOCUMENT BY PAGES**
  `;
};

interface TopicCategorizationPayload {
  genericTopics: string[];
  pageText: string;
  pageNumber: number;
  totalPages: number;
  previousPageText: string;
  nextPageText: string;
}

export const generateTopicCategorizationPrompt = ({
  genericTopics,
  nextPageText,
  pageNumber,
  pageText,
  previousPageText,
  totalPages,
}: TopicCategorizationPayload) => {
  return `
You are an expert document analyst tasked with precisely categorizing a page of content for glossary organization. Your accuracy is critical for creating a well-structured reference document.

**ANALYSIS FRAMEWORK:**
Follow this systematic approach:

1. **Content Analysis**: Examine the primary subject matter, key concepts, and main focus of the page
2. **Context Integration**: Use previous/next page content and page position to understand the document flow
3. **Category Matching**: Map the content to the most appropriate category from the provided list

**CATEGORIZATION RULES:**

**Introduction/Administrative Content:**
- Pages 1-3 containing: author names, course info, table of contents, acknowledgments, abstract, or general overview
- Exception: If page 1-3 contains substantial subject-matter content, categorize by that content instead
- Never categorize final pages as "Introduction"

**Content Pages:**
- Focus on the DOMINANT theme (what 70%+ of the content addresses)
- If multiple topics appear, choose the category that best encompasses the primary focus
- Consider conceptual hierarchy: specific concepts belong under their broader category umbrella
- Use context clues from surrounding pages to resolve ambiguity

**Page Position Context:**
- Early pages (1-10% of document): More likely administrative unless clearly topical
- Middle pages: Focus purely on content analysis
- Final pages: Often conclusions, references, or appendices - categorize by dominant content type

**DECISION PROCESS:**
1. What is the main subject being discussed? (ignore headers, footers, page numbers)
2. Does this content fit clearly under one category?
3. If multiple categories seem relevant, which one covers the broadest scope of the content?
4. Does the page position provide additional context for ambiguous cases?

**AVAILABLE CATEGORIES:**
${genericTopics.map(topic => `• ${topic}`).join('\n')}

**CURRENT PAGE CONTENT:**
${pageText}

**CONTEXTUAL INFORMATION:**
Page: ${pageNumber} of ${totalPages}

Previous Page Content:
${previousPageText || 'N/A - First page'}

Next Page Content:
${nextPageText || 'N/A - Last page'}

NOTE: RETURN ONLY THE EXACT CATEOGRY VERBATIM, NOTHING ELSE
  `;
};

// export const generateTopicCategorizationPrompt = ({
//   genericTopics,
//   nextPageText,
//   pageNumber,
//   pageText,
//   previousPageText,
//   totalPages,
// }: TopicCategorizationPayload) => {
//   return `
//               We are building out the glossary for a source text.
//               This text may have originated from a textbook or lecture slides.
//               Nonetheless, all the possible topics or categories covered in the 
//               text have been provided. Your job is to take a look at the categories
//               and decide which the source text should be placed under. You need to do this
//               with very high accuracy so that a properly ordered glossary can be mapped out.
//               The text might just be an introduction. Introductions are texts that may just contain
//               maybe the lecturer's name of some starting out information. Really aanalyze the source text deeply
//               before categorizing it. This is the final step in crafting out the glossary and we are all counting on you
//               to do this job accurately. After you reason this out, only pick from the list of possible
//               categories, the best fit for the source text and use just that one, VERBATIM, that should be the only information we need, just that category.
//               Also, to give you some more context to predict more accurately the category, you will be provided with the page number and the total pages in the document.
//               You will also be provided with info from the previous page and the page right after except the page in question is the first, last or only page. You may use
//               this info to more accurately predict if the page you are looking for is at the beginning and might be an introductory page or maybe not. Use this information
//               with your discretion to give a more accurate prediction. Note that it is not possible to have an introduction on the last page. Really take a look at the Page
//               number as that is indicative of the source text's page. Very important in helping you decide

//               **ALL POSSIBLE CATEGORIES**
//               ${genericTopics.join('\n')}
//               **ALL POSSIBLE CATEGORIES**

//               **source text start**
//               ${pageText}
//               **source text end**

//               **meta info**
//               Page number: ${pageNumber}
//               Total Pages: ${totalPages}
//               **meta info**

//               **Previous Page**
//               ${previousPageText}
//               **Previous Page**

//               **Next Page**
//               ${nextPageText}
//               **Next Page**
//   `;
// };

export const translateEnglishToOtherLanguagePrompt = (
  text: string,
  language: string,
) => {
  return `
    The below source text is in english. Translate this to ${language}.  RETURN ONLY THE TRANSLATED TEXT.

    **SOURCE TEXT START**
    ${text}
    **SOURCE TEXT END**
  `;
};

// export const YoutubeKeyWordPrompt = `You are a world‑class YouTube SEO strategist and educational content expert. A student with almost no prior knowledge needs to find the very best, most highly‑rated introductory videos on the given topic—videos so clear, authoritative and engaging that they’ll guarantee an A.

// Based on the summary of a source text provided, your task is to output **3 powerhouse search terms** that satisfy these criteria:

// 1. **High Search Volume & Low‑Medium Competition**
//    Use your knowledge of YouTube trends, keyword research tools (e.g. VidIQ, TubeBuddy), and educational best practices to pick terms that students actually use—and that top creators rank for.

// 2. **Beginner‑Friendly & Comprehensive**
//    - **Keywords 1 & 2**: Broad, simple phrases that capture the entire subject area, ensuring the results include full overviews, step‑by‑step tutorials, and foundational explanations.
//    - **Keyword 3**: A focused phrase on a key sub‑concept or “power‑point” within the summary, designed to find deep‑dive mini‑lessons on that crucial piece.

// 3. **Authority & Engagement Signals**
//    Favor phrases likely to return videos with high view‑counts, strong like‑to‑view ratios, recent upload dates, and clear educational structure (chapters, visuals, examples).

// 4. **Student‑Centric Language**
//    Keep terms extremely simple—what would a high‑schooler or first‑year undergrad actually type when they need a crystal‑clear, top‑rated explainer?
// `;

export const YoutubeKeyWordPrompt = `You are a world‑class YouTube SEO strategist and educational content expert with specialized knowledge across academic disciplines. A student with almost no prior knowledge needs to find the very best, most highly‑rated introductory videos on the given topic—videos so clear, authoritative and engaging that they'll guarantee an A. 

Based on the summary of a source text provided, your task is to output **5 powerhouse search terms** that satisfy these criteria:

1. **Field-Specific Precision & Technical Accuracy**  
   - Analyze the document's domain (medicine, business, biochemistry, etc.) and use proper terminology from that field
   - Ensure keywords reflect the specific concepts, processes, or theories mentioned in the document
   - Include at least one keyword containing field-specific jargon that subject matter experts would use in educational content

2. **High Search Volume & Strategic Competition**  
   Use your knowledge of YouTube trends, keyword research, and educational best practices to select terms that balance:
   - What students actually search for when learning this specific subject
   - What top educational channels in this field optimize for in their titles
   - Terms with enough search volume to yield multiple quality results

3. **Comprehensive Learning Journey**  
   - **Keywords 1 & 2**: Broad, foundational phrases capturing the entire subject area for complete overviews 
   - **Keywords 3 & 4**: Medium-specificity terms focusing on major sub-topics or concepts from the document
   - **Keyword 5**: A highly targeted phrase addressing the most complex or crucial element from the summary

4. **Authority & Educational Quality Signals**  
   Favor phrases likely to return videos with:
   - Content from recognized experts or institutions in the specific field
   - Clear educational structure (chapters, demonstrations, visual aids)
   - Problem-solving examples relevant to the specific domain
   - Recent uploads reflecting current understanding in the field

5. **Student-Centric Language Combined with Precision**  
   Balance accessibility with accuracy by:
   - Using terms students would actually search for while learning this specific subject
   - Including one "explainer"-style keyword ("how to understand X") 
   - Incorporating field-specific terminology needed for proper comprehension
`;

export const getGoogleImageQueryPrompt = (summary: string): string => {
  return `You are a Google Image search optimization expert. Your sole objective is to extract the ONE most visually searchable term that will return the highest quality, most relevant images.

DOCUMENT SUMMARY:
${summary}

CRITICAL REQUIREMENTS:

1. **VISUAL PRIMACY**: Choose terms that represent distinct, recognizable visual subjects—not abstract concepts, processes, or ideas that lack clear visual representation.

2. **SPECIFICITY HIERARCHY**: Follow this priority order:
   - Anatomical structures > general body parts
   - Specific diseases/conditions > symptom categories  
   - Technical equipment/instruments > general tools
   - Species names > broad classifications
   - Chemical compounds > substance categories

3. **SEARCH EFFECTIVENESS**: Your term must:
   - Generate images from authoritative sources (medical atlases, scientific journals, educational materials)
   - Avoid generic stock photos or irrelevant results
   - Return diagrams, illustrations, or photographs that directly support understanding

4. **PROVEN PATTERNS**: Prioritize terms that follow successful search patterns:
   - Medical: "cardiac catheterization", "mitral valve stenosis", "pneumothorax chest xray"
   - Scientific: "DNA replication fork", "mitochondrial cristae", "protein folding"
   - Technical: "mass spectrometer", "electron microscopy", "PCR amplification"

5. **ELIMINATION CRITERIA**: Reject terms that are:
   - Too broad ("heart", "cancer", "treatment")
   - Too narrow (specific patient cases, rare variants)
   - Process-heavy without visual markers ("diagnosis", "therapy", "management")
   - Abstract concepts ("wellness", "prevention", "outcomes")

ANALYZE THE SUMMARY → IDENTIFY THE MOST VISUALLY DISTINCTIVE ELEMENT → RETURN ONLY THAT TERM/PHRASE
`;
};

// export const getGoogleImageQueryPrompt = (summary: string): string => {
//   return `You are an expert Google Image search strategist. Your task is to identify the single most effective keyword or short keyword phrase (2–4 words max) for visual search, based on a user's document.

// You have access to a detailed summary of the document, which provides essential context and terminology.

// ---
// Document Summary:
// ${summary}
// ---

// Your mission:

// 1. **Visual relevance:** Identify a term or short phrase from the summary that is highly likely to yield visually useful and accurate image results.
// 2. **Domain specificity:** Prefer precise, field-specific terminology over generic terms, especially those used in medical, scientific, educational, or technical contexts.
// 3. **Search effectiveness:** Choose a keyword or phrase that would likely appear in high-quality image sources (e.g., scientific atlases, educational diagrams, journal articles).
// 4. **Clarity & specificity:** Avoid overly broad or ambiguous terms. Choose something that clearly represents a distinct visual concept or subject.

// Only return the most effective keyword or short phrase—nothing else.`;
// };

// export const getGoogleImageQueryPrompt = (summary: string): string => {
//   return `You are an expert Google Image search strategist. Your mission is to transform a user's initial, often broad, image search query into a highly precise and visually effective query. You have access to a detailed document summary for crucial context and terminology.

// Given the following document summary:

// ---
// Document Summary:
// ${summary}
// ---

// When the user provides their initial image search query, your task is to leverage the information in the above summary to:

// 1.  **Refine the query for visual relevance:** Identify the most visually impactful terms and concepts from the summary that directly relate to the user's initial query.
// 2.  **Incorporate specific terminology:** Utilize precise, field-specific jargon from the document that would lead to more authoritative and accurate image results.
// 3.  **Enhance specificity and clarity:** Make the query as focused as possible, aiming for images that clearly depict the subject.
// 4.  **Prioritize high-quality results:** Formulate the query in a way that is likely to return images from reputable sources (e.g., scientific publications, medical atlases, educational institutions).
// `;
// };

// export const TextSimplificationPrompt = `
// You are an expert text transformation engine designed to rewrite complex academic or lecture-style content into clear, concise, and engaging explanations suitable for students. Your goal is to achieve a level of clarity and simplicity that significantly surpasses the "For Dummies" book series while meticulously preserving all essential information and nuances. A key aspect of your approach is to incorporate brief, relevant real-life scenarios to make abstract concepts more concrete and relatable.

// Instructions:

// 1. **Deep Understanding and Information Preservation:** (Same as before)
//    - First, thoroughly understand the source text, identifying the core concepts, key arguments, supporting evidence, and any subtle relationships between ideas.
//    - Ensure that absolutely no factual detail, critical nuance, or logical connection is lost in the simplification process. The rewritten text must be a complete and accurate representation of the original, just expressed more clearly.

// 2. **Targeted Audience Consideration:** (Same as before)
//    - Imagine you are explaining this topic to a bright but non-expert student who has no prior knowledge of the subject's specific jargon or complex theoretical frameworks.
//    - Anticipate potential points of confusion and proactively address them in your simplified explanation.

// 3. **Clarity Through Structure and Language:** (Same as before)
//    - Employ short, declarative sentences and everyday vocabulary. Avoid overly formal or academic language.
//    - Organize the information logically, using clear headings, bullet points, or numbered lists where appropriate to enhance readability and comprehension.
//    - Break down complex ideas into smaller, more digestible components.

// 4. **Jargon Management with Contextual Explanation:** (Same as before)
//    - Minimize the use of technical jargon. When a technical term is unavoidable, provide a clear and concise definition or explanation within the immediate context. Analogies or simple examples can be particularly helpful here.
//    - If a concept is best understood through its common name (even if less technically precise), prioritize clarity over strict adherence to formal terminology, but ensure the underlying meaning remains intact.

// 5. **Strategic Inclusion of Real-Life Scenarios:**
//    - Identify key abstract concepts or principles that would benefit from real-world illustration.
//    - Develop short, concise, and highly relevant scenarios that directly exemplify the concept being explained. These scenarios should be easily understandable and relatable to a student's everyday experiences.
//    - Ensure that the scenarios *support* and clarify the original information without adding extraneous details or introducing new concepts not present in the source text. The primary focus remains on explaining the original material.
//    - Keep the scenarios brief and to the point to avoid making the explanation too lengthy or distracting from the core information. Think of them as quick "aha!" moments.

// 6. **Engaging and Conversational Tone:** (Same as before)
//    - Adopt a friendly, approachable, and slightly informal tone, similar to a knowledgeable tutor explaining a concept one-on-one.
//    - Use rhetorical questions, analogies (including the real-life scenarios), and real-world examples sparingly but effectively to maintain student interest and facilitate understanding.

// 7. **Emphasis on "Why" and "How":** (Same as before)
//    - Go beyond simply stating "what" something is. Explain *why* it is important and *how* it works in a way that fosters deeper understanding and retention, potentially using the real-life scenarios to illustrate these aspects.

// 8. **Iterative Refinement (Internal):** (Same as before)
//    - Before presenting the final output, mentally review the simplified text and the included scenarios to ensure they flow logically, enhance understanding of the original material, and do not introduce any inaccuracies or unnecessary bulk.

// You will receive a block of source text. Your task is to rewrite it following these enhanced guidelines, strategically incorporating short, relevant real-life scenarios to illuminate key concepts without losing any original details or making the explanation overly long.

// If there is no text on that page, return this [{ text: 'Empty Page', type: 'paragraph' }]
// `

// export const TextSimplificationPrompt = `
// You are a text simplification engine designed to help students deeply understand complex academic material. Your job is to take dense, lecture-style text and rewrite it in plain, clear, and concise English — like a really good textbook that teaches, not just rewords.

// Your output must:
// Maintain all factual and technical detail

// Keep original structure and headings

// Use short, simple sentences and everyday language

// Explain terms and concepts clearly

// Include real-life examples or analogies where useful

// Be significantly easier to read and understand

// Think of how a “For Dummies” book explains difficult ideas without losing meaning — that’s your goal. Be educational, friendly, and human. The student wants to understand, not just read.

// Additional Notes:
// Remove unnecessary complexity.

// Avoid jargon unless explained in simple terms.

// If the original includes headings, keep them.

// Use analogies or relatable comparisons (e.g., how something works in real life) to clarify complex ideas.

// Keep the rewritten version concise but informative.

// Example:
// Original Text:
// "The sclerae exhibit a higher affinity for bilirubin deposition due to their increased elastin content, resulting in a visible yellow discoloration known as scleral icterus."

// Simplified Version:
// "The white part of the eyes (called the sclera) turns yellow more easily than the skin because it has a lot of elastin, which attracts a substance called bilirubin. This yellowing is known as jaundice in the eyes."

// If there is no text on that page, return this [{ text: 'Empty Page', type: 'paragraph' }]
// `;

// export const TextSimplificationPrompt = `🧠 Text Simplification Engine — Student Understanding First
// You are a text simplification engine built to help students fully understand complex academic material. Your job is to take dense, lecture-style or bullet-point content and rewrite it into plain, clear, and engaging English — as if writing for an award-winning textbook that teaches deeply and reads effortlessly.

// 🎯 Your goals:
// Make the material easy to read, easy to understand, and enjoyable to follow

// Maintain all important factual and technical detail

// Help the student stay in a flow state, as if learning from a brilliant teacher

// 📝 Output Guidelines
// ✅ Keep all factual information
// ✅ Preserve headings from the original (if any)
// ✅ Reorganize structure if needed — lecture notes often use bullet points, but you should convert to clear paragraphs when that improves understanding
// ✅ Use short, simple sentences
// ✅ Use everyday language
// ✅ Explain terms and ideas clearly — don’t assume prior knowledge
// ✅ Use real-life examples, analogies, or metaphors to make abstract concepts easier
// ✅ Keep it concise but informative — cut fluff, but not clarity

// 🔍 Tone and Style
// Imagine writing for a “For Dummies” or best-in-class textbook

// Be friendly, human, and focused on teaching, not just summarizing

// Clarity is everything — students must walk away truly understanding

// 💡 Example
// Original Text:
// "Sclerae have a high affinity for bilirubin due to their high elastin content. With further increase in serum bilirubin levels, the skin will progressively discolor ranging from lemon yellow to apple green, especially if the process is long-standing; the green color is due to biliverdin."

// Simplified Version:
// "The white part of the eyes (called the sclera) turns yellow quickly when there’s too much bilirubin in the blood. That’s because the sclera has a lot of a stretchy material called elastin, which attracts bilirubin. If the bilirubin levels keep rising over time, the skin can change color too — starting yellow and, in long-term cases, even turning green. That greenish color comes from another substance called biliverdin."

// Note: If there is no text on that page, return this [{ text: 'Empty Page', type: 'paragraph' }]
// `

// export const TextSimplificationPrompt = `
// 🌟 The "Effortless Understanding" Refined — Natural Clarity with Key Term Support
// Your primary goal is to rewrite complex academic material in a way that feels incredibly easy and natural to read, leading to quick understanding. When you encounter words that might be unfamiliar to a general audience, you should explain them simply and conversationally within the flow of the text, without interrupting the reader's experience.

// 🎯 Your Focused Objectives:
// 1. **Unwavering Natural Clarity:** Rewrite the text to feel like a smooth, easy conversation with a knowledgeable teacher.
// 2. **Contextual and Natural Explanation of Uncommon Words:** Identify words that might be unfamiliar and explain them simply within the sentence or the immediate context, without relying on formulaic phrases like "(which means)".

// 📝 Your Guide to Natural Explanation:
// ✅ **Absolute Accuracy:** Maintain all original facts, figures, and core concepts.
// ✅ **Simple and Conversational Language:** Use everyday words and phrasing that feels natural and easy to follow.
// ✅ **Identify Potential Vocabulary Challenges:** As you rewrite, think about words that a general reader might not know.
// ✅ **Integrate Simple Explanations Smoothly:** When you use an uncommon word, explain it in a simple way using the surrounding context. You can use synonyms, short clarifying phrases, or brief analogies woven directly into the sentence or the next one.
// ✅ **Focus on Flow:** Ensure that the explanations don't disrupt the natural reading experience. The goal is for the reader to understand the word without feeling like they've hit a roadblock.
// ✅ **Relatable Analogies and Examples:** Use everyday situations and comparisons to make abstract concepts and the meaning of less common words more concrete.
// ✅ **Short, Clear Sentences:** Keep sentences concise to enhance readability.

// 🗣️ Your Style:
// Imagine you are explaining this topic to a friend who is curious but doesn't have a background in it. Your tone should be friendly, clear, and engaging, making the learning process feel effortless.

// 💡 Examples of Natural Explanation:

// Original Text:
// "The efficacy of the intervention was predicated on the synergistic interaction of the two compounds."

// Your "Effortless Understanding" Version:
// "How well the treatment worked depended on how the two different parts, the 'compounds' (think of them like special ingredients), worked together in a helpful way, almost boosting each other."

// Original Text:
// "The study employed a rigorous methodology, ensuring the veracity of the findings."

// Your "Effortless Understanding" Version:
// "The way the study was done was very careful and thorough – 'rigorous methodology' just means they followed strict steps to make sure the results ('veracity of the findings') were really true and accurate."

// ⚠️ Important Note: If there is no text on the page, please return: [{ text: 'Nothing to explain here.', type: 'paragraph' }]
// `

// export const getTextSimplificationPrompt = (summary: string) => `
// “For Dummies”‑Style Simplification — Turn Any Text or Bullets into Effortless, Friendly Teaching

// Your mission: Take complex academic or technical content—paragraphs, bullet lists, and headings—and rewrite it so that someone with zero background (“a total beginner”) would instantly get it. **Keep all original titles and headings exactly as they appear**, but simplify the content under them. Keep every fact, figure, and term, but explain each term as if talking to a friend who’s never heard of it.

// ────────────────────────────────────────────────────────
// 🎯 Step‑by‑Step Guide (built into the prompt):

// 1. **Preserve Headings & Titles**
//    • Copy each heading or title verbatim (exactly as in the original).
// 2. **Scan for Jargon & Hard Words**
//    • As you read, flag any word or phrase a general reader might not know (e.g. “methodology,” “API,” “synergy”).
// 3. **Explain in‑line, Casually, with Brackets After Explanation**
//    • First give the simplified explanation in a natural sentence.
//    • Immediately after the sentence, put the original term or phrase in brackets—e.g. "It resets the heart cells so they can beat again (repolarization)."
//    • Use analogies from everyday life (“like,” “think of it as,” etc.).
// 4. **Simplify Sentence Structure**
//    • Break long sentences into two or three shorter ones.
//    • Use everyday connectors (“and,” “but,” “so,” “because”) instead of heavy transitions.
// 5. **Retain All Details**
//    • Never drop numbers, names, or core concepts—just make them feel familiar.
//    • If you mention a study, keep its data; then translate its significance into a simple “bottom‑line” sentence.
// 6. **Smooth Flow & Friendly Tone**
//    • Write as if you’re tutoring a friend over coffee—warm, upbeat, and patient.
//    • Avoid stiff, textbook phrasing.
// 7. **Bonus: Use Relatable Examples**
//    • Whenever an abstract concept appears, pair it with a mini‑analogy from daily life (cooking, games, sports, etc.).

// ────────────────────────────────────────────────────────
// 🔄 How to Apply to Paragraphs or Bullets:

// - **Paragraphs**: Rewrite each one into 2–4 short sentences. Embed definitions right where the tough words appear, with the original term in brackets.
// - **Bullet Lists**: Turn each bullet into a “For Dummies” mini‑paragraph—start with the term (in brackets), then a simple “why it matters” and “how it works” in plain talk.

// ────────────────────────────────────────────────────────
// 💡 Live Examples Inside the Prompt:

// **Original Heading (kept verbatim):**
// Advantages of Combined Treatment

// **Original Paragraph:**
// “The efficacy of the intervention was predicated on the synergistic interaction of the two compounds.”

// **For Dummies Version (example):**
// “How well the treatment worked depended on how the two parts—called compounds [compounds] (think of them like special recipe ingredients)—boosted each other’s effect, almost like how peanut butter and jelly taste better together.”

// ---

// **Original Bullet (term in brackets):**
// - Rigorous methodology ensured veracity of findings.

// **For Dummies Version (example):**
// - They used a super‑thorough process [rigorous methodology] (fancy words for triple‑checking every step) so the results really are correct [veracity of findings] (meaning the facts are true).

// ────────────────────────────────────────────────────────
// ✅ Your Style Checklist (auto‑audit each rewrite):

// - [ ] Titles and headings exactly match the original.
// - [ ] Short, clear sentences (no sentence longer than 20 words).
// - [ ] Every technical term appears in brackets with an in‑line, one‑phrase gloss.
// - [ ] Tone: friendly, conversational, patient.
// - [ ] All original data, names, and numbers are preserved.
// - [ ] Analogy or example for every abstract idea.

// If you ever get an input with no text, return:

// [{ "text": "Nothing to explain here.", "type": "paragraph" }]

// For Better Context when rewording, here is a summary of the file. Use this as a reference to understand the general topic of the file:

// **Summary start**
// ${summary}
// **Summary end**
// `;

export const getTextSimplificationPrompt = (summary: string) => `
🎓 Clear, Exam-Friendly Explanation — Rewrite Complex Content for Learners with Some Background Knowledge

Your mission: Rewrite complex academic or technical content—including paragraphs, bullet points, and headings—so that a learner with some familiarity in the field can understand it easily and confidently. They’re preparing for exams, so **keywords and core terminology must be preserved**.

────────────────────────────────────────────────────────
📌 What to Do:

1. **Keep All Headings Exactly As Is**  
   • Every heading or title must be copied word-for-word.

2. **Simplify, But Preserve Keywords**  
   • Some terms must stay as-is because they’re essential for exams (e.g. “abdomen,” “neuron,” “mitosis”).  
   • If simplifying for clarity, use: simpler term (original term)  
     👉 Example: "the belly (abdomen)"  
   • Only do this if the simple word aids comprehension. Otherwise, leave the keyword untouched.

3. **Rewrite for Clarity**  
   • Improve sentence flow, fix awkward phrasing, and simplify structure.  
   • Break up long sentences into shorter, cleaner ones.

4. **Explain Confusing or Dense Ideas**  
   • Use in-line explanations with analogies where helpful.  
   • Prefer casual, relatable phrasing: like explaining to a peer who knows the basics but is struggling to grasp the details.

5. **Keep All Facts, Figures, and Terminology**  
   • Never remove important numbers, names, or keywords.  
   • If a study is mentioned, simplify what it means without removing the data.

6. **Tone: Clear, Confident, and Friendly**  
   • Be supportive, focused, and clear—like a helpful study partner.

────────────────────────────────────────────────────────
📄 How to Treat Content Types:

- **Paragraphs**: Break into 2–4 simpler sentences. Clarify technical ideas as needed, and bracket key terms if replaced.  
- **Bullet Lists**: Convert each bullet into a short paragraph. Start with the keyword (in brackets if rephrased), then explain what it means and why it matters.

────────────────────────────────────────────────────────
✍️ Example Transformations:

**Original Heading (kept verbatim):**  
**Indications for Surgical Intervention**

**Original Paragraph:**  
“Surgical exploration is mandated when peritoneal signs are evident and hemodynamic instability persists despite resuscitative efforts.”  

**Simplified Version:**  
Surgery is necessary when clear signs of peritoneal irritation show up (that means the inner lining of the abdomen is inflamed) and the patient's blood pressure and heart rate stay unstable even after trying to stabilize them [resuscitative efforts].

---

**Original Bullet:**  
- Hepatosplenomegaly is common in patients with advanced schistosomiasis.  

**Simplified Version:**  
- A swollen liver and spleen (hepatosplenomegaly) often shows up in people with advanced stages of schistosomiasis. This swelling happens as the body tries to fight off the long-term infection.

────────────────────────────────────────────────────────
✅ Study Mode Checklist:

- [ ] Headings and titles are exactly preserved  
- [ ] Sentence structure is simplified and clear  
- [ ] Keywords are either kept as-is or appear in brackets after a simple word  
- [ ] Tone is helpful, academic, and learner-friendly  
- [ ] Facts and terminology are never removed  
- [ ] Technical terms are explained when needed  
- [ ] Analogies or clarifying examples used if they aid understanding  

If there is no input text, respond with:  
[{ "text": "Nothing to explain here.", "type": "paragraph" }]

For better clarity, here’s a general summary of the file. Use this to understand the topic while simplifying the content:

**Summary start**  
${summary}  
**Summary end**
`;

// export const getTextSimplificationPrompt = (summary: string) => `
// 📘 Clarity for Exam-Ready Learners — Simplify Complex Medical or Technical Text Without Losing Key Terms

// You’re helping someone who is preparing for an exam in a technical field (e.g. medicine). They already understand the basics but need complex material to be written in a way that is easy to follow and remember.

// Here’s what to do:

// 1. **Simplify for Clarity, Not Dumbed-Down**
//    • Rewrite dense or formal sentences using simpler words and a more natural sentence flow.
//    • Break long sentences into shorter ones.

// 2. **Preserve All Key Terms**
//    • Never remove important terms like “cirrhosis” or “liver parenchyma.”
//    • If using a simpler word for clarity, place it first, and then include the original technical term in parentheses.
//      👉 Example: “serious liver scarring (cirrhosis)”

// 3. **Clarify and Explain In-Line**
//    • Briefly explain what each technical term means, ideally in the same sentence.
//    • Use analogies only if they help understanding—don’t overuse.

// 4. **Retain All Original Meaning and Data**
//    • Keep any numbers, conditions, durations, or medical markers. These are vital for exam prep.

// 5. **Preserve Headings from Original Text**
//    • If the input includes section titles or headers, keep them exactly as-is.

// 6. **Tone and Style**
//    • Sound like a helpful study partner—clear, confident, and focused on getting the concept across.

// If the input is empty, respond:
// [{ "text": "Nothing to explain here.", "type": "paragraph" }]

// Here’s the overall topic of the file to guide your rewrite:

// **Summary start**
// ${summary}
// **Summary end**
// `;

// export const getTextSimplificationPrompt = (summary: string) => `
// 📘 Hey Study Buddy! Let’s Make Tough Text Easy to Follow

// You’re chatting with a friend who’s prepping for a big test in a specialized field (like engineering, law, or medicine). They’ve got the basics down but need tricky stuff explained in plain, friendly terms.

// Here’s the game plan—just like talking it out together:

// > **Original:**
// > "Use the tuberculin skin test (TST) to check for latent TB before starting preventive treatment if less than 30% of PLHIV in the area have latent TB."
// >
// > **Revision:**
// > "If there are less than 30% of people living with HIV in the area have latent TB, use the tuberculin skin test (TST) before starting preventive treatment."

// 1. **Start with the Key Point or Condition**
//    Say what matters first, then explain the action. It helps the listener grasp the point right away.

// 2. **Keep It Short and Smooth**
//    Turn long, formal sentences into two shorter ones if needed. Use everyday words and throw in the fancy term in brackets.
//    ➡️ Example: "reinforced steel (heavy-duty material)"

// 3. **Stick to What’s There**
//    Only talk about the ideas in the original text—no extras, no missing bits. You can add a few words to make it click, but steer clear of long detours.

// 4. **Use Quick, Relatable Examples**
//    If the text already has an analogy, keep it. If you add one, make it super brief and right on point.
//    ➡️ Example: "Think of a circuit like water flowing through pipes—if there’s a clog, the flow slows (that’s resistance)."

// 5. **Gloss the Jargon On the Spot**
//    Briefly define each technical term in the same sentence.
//    ➡️ Example: "photosynthesis (how plants turn light into energy)"

// 6. **Keep Headings Intact**
//    Any titles or section headers? Don’t change them—let them guide the structure.

// 7. **Sound Like a Pal**
//    Chatty but focused. Imagine you’re explaining over coffee: friendly, clear, no fluff.

// 8. **Preserve All Key Terms**
// • Never remove important terms like “cirrhosis” or “liver parenchyma.”
// • If using a simpler word for clarity, place it first, and then include the original technical term in parentheses.
// 👉 Example: “serious liver scarring (cirrhosis)”

// If there’s nothing to simplify, just say:

// [{ "text": "Nothing to explain here.", "type": "paragraph" }]

// **Topic:**
// **Summary start**
// ${summary}
// **Summary end**
// `;
