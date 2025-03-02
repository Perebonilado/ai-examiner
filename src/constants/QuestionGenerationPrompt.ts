// Types
export type QuestionType =
  | 'Flash Cards'
  | 'Multiple Choice'
  | 'Multiple True-False'
  | 'Oral (Viva)';

interface PromptConfig {
  questionCount: number;
  focusAreas?: string[];
  includeCaseStudies: boolean;
  questionType: QuestionType;
}

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
- Regularly refer back to the document to find fresh content for new questions
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
   • Need synthesis of information from different document sections
   • Force consideration of multiple factors simultaneously
   • Challenge common misconceptions with nuanced statements`;

const CORRECT_ANSWER_DISTRIBUTION = `
CRITICAL: Vary the position of the correct answer within the options. If the first question has A as its correct option, the next question may have D as its correct option. Ensure this is varied. THERE SHOULD BE NO PATTERN, THERE SHOULD BE AN UNEVEN DISTRIBUTION OF EITHER A, B, C OR D AS THE CORRECT OPTION. HOWEVER, EACH QUESTION SHOULD HAVE AT LEAST ONE AS ITS CORRECT OPTION. THIS IS COMPULSORY AND NON-NEGOTIABLE.`;

// Helper functions
const getTopicTaggingInstructions = (hasFocusAreas: boolean): string => `
TOPIC TAGGING INSTRUCTIONS [VERY IMPORTANT]:
- ${
  hasFocusAreas
    ? 'Tag each question PRECISELY to the specific focus area it covers'
    : 'IDENTIFY and TAG each question with the most appropriate topic from the document'
}
- Topic tags should be EXTREMELY PRECISE and DIRECTLY RELATED to the question's content
- Use concise, specific topic names that clearly indicate the exact concept being tested
- Ensure each question is tagged to ONLY ONE primary topic
${!hasFocusAreas ? '- Ensure that topics are broad concepts within the document that the question touches on.' : ''}`;

const getQuestionFormats = (questionType: QuestionType): string => {
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
      return 'For each option, determine if it is true or false based on the document content';
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
1. Ensure relevance to document content
2. Provide 4 options with unique IDs${questionType === 'Flash Cards' ? ', with the correct answer as the first option' : ''}
3. ${getOptionInstructions(questionType)}
4. ${getAnswerFormatInstructions(questionType)}
5. Add a hint that aids recall without revealing the answer
6. Include a detailed explanation. ${getExplanationInstructions(questionType)}
7. Ensure the questions and options are ${questionType === 'Flash Cards' ? 'clear, concise, and promote effective memorization' : 'difficult and thought provoking'};`;

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
IMPORTANT: Create questions based on realistic scenarios that apply the concepts from the document. These case studies must be extremely challenging and require deep, multi-step reasoning, even for seasoned professors.

- For medical materials:
  - Begin each question with a concise yet detailed patient case or clinical situation.
  - Include critical details such as patient demographics, presenting symptoms, vital signs, laboratory or imaging results, and relevant medical history.
  - Ensure the scenario reflects real clinical complexity and mirrors challenges encountered in actual patient care.
  - Frame the question to test advanced clinical reasoning, differential diagnosis, treatment planning, or interpretation of diagnostic data.

- For non-medical materials:
  - Develop realistic scenarios or case studies that are directly relevant to the document's subject matter.
  - Incorporate practical examples, contextual data, or situation-specific details that ground the scenario in real-world applications.
  - Frame the question to test application of knowledge, critical analysis, and decision-making in a manner that reflects genuine challenges in the field.

- In all cases:
  - Vary the types of scenarios (e.g., for medical: diagnosis, treatment planning, interpretation of results; for non-medical: strategic decision making, process analysis, problem-solving).
  - Ensure that answering the question demands an integrated understanding of the document’s content and the ability to synthesize multiple layers of information.
  - Avoid overly simplistic or rare scenarios; every case study must be sufficiently complex to force deep reasoning.

${CORRECT_ANSWER_DISTRIBUTION}
THIS INSTRUCTION IS CRITICAL FOR ALL QUESTIONS - STRICTLY ADHERE TO CREATING SCENARIO-BASED QUESTIONS THAT APPLY DOCUMENT CONCEPTS.
`;

const getDirectQuestionPrompt = (questionType: QuestionType): string => `
CRITICAL INSTRUCTIONS:  
- Generate ONLY direct, concept-driven questions that demand advanced reasoning, deep understanding, and synthesis of knowledge.  
- Questions should **not** rely on simple recall but instead require:  
  • Identifying **underlying assumptions** in theories or principles.  
  • Recognizing **logical contradictions** or hidden complexities.  
  • Applying abstract concepts in **unconventional ways**.  
  • Analyzing the **interdependencies** between concepts.  
  • Evaluating how a concept **changes under different conditions**.  
- Ensure that questions force users to engage in prolonged critical thinking, **even if the answer is brief**.  

### Key Enhancements for Difficulty  
- Introduce **counterintuitive** answer choices that challenge common misconceptions.  
- Force respondents to **compare and contrast** subtly different concepts.  
- Use **incomplete information**, requiring inference and extrapolation.  
- Frame questions to reveal **hidden relationships** between concepts.  
- Encourage **long-form mental reasoning**, even if the question appears simple.  

### Format Examples  
${getQuestionFormats(questionType)}

### Example  
Instead of:  
❌ "What is Newton’s First Law?"  
It will generate:  
✅ "If Newton’s First Law holds universally, why do objects in motion appear to slow down? Identify the implicit factors that alter its observed effects."  

STRICT REQUIREMENT:  
- DO NOT simplify the questions.  
- DO NOT make answers obvious.  
- Questions should require **active intellectual effort** to solve.  
`;

const getFlashCardPrompt = (): string => `
IMPORTANT: For flashcard questions, generate questions that, while eliciting a concise answer, demand advanced, multi-layered reasoning and deep conceptual analysis. Each question should appear straightforward but be underpinned by complex, nuanced insights that challenge even experienced professors. The answer itself should be a simple key term or definition, yet arriving at that answer must require careful, multi-step thought.

- Frame each flashcard question to test advanced recall of key terms, definitions, intricate processes, historical events, and interrelated concepts.
- Craft questions that require integrating contextual details and subtle nuances to force the respondent to consider multiple facets of the concept before deducing the simple answer.
- Use varied and challenging question formats, such as:
  • "Considering the multifaceted implications of [context], what is the precise definition of [term/concept]?"
  • "Given the complex interplay of factors in [advanced scenario], what is the primary function of [structure/organ]?"
  • "Within the nuanced framework of [historical or scientific context], who is credited with [discovery/achievement]?"
  • "Analyzing intricate anatomical details, where is [anatomical structure] precisely located?"
  • "Integrating principles from advanced chemistry, what is the chemical symbol for [element]?"
  • "In a system characterized by layered processes, in which segment does [process] occur?"
  • "Considering the underlying principles of [law/theory] in depth, what does it explicitly state?"
  • "When evaluating the subtle causes behind [condition/phenomenon], what is identified as the main cause?"
  • "Taking into account historical complexities, what year did [event] occur?"
  • "Within the framework of detailed system analysis, what is the definitive role of [component]?"
  • "What are the critical characteristics of [concept/structure] when examined from an advanced perspective?"
  • "How does the relationship between [concept A] and [concept B] manifest when analyzed in depth?"
  • "What is the next logical step in [process] following [step], given the underlying complexities?"
  • "Considering the antithetical nature of [concept/term] under rigorous analysis, what is its opposite?"
  • "Identify a sophisticated real-world example of [concept/principle] that illustrates its multifaceted nature."
  • "What are the three essential stages of [process] when analyzed in detail?"
  • "What is the advanced significance of [event/concept] within its broader context?"
  • "Using rigorous analytical reasoning, what is the formula for [calculation/concept]?"
  • "Distinguish the differences between [term A] and [term B] through an in-depth comparative analysis."
  • "In the context of advanced systems, what is the primary purpose of [tool/technique]?"
  • "Enumerate the inputs and outputs of [process] considering its dynamic interplay."
  • "Outline the sequence of events in [process] when examined through advanced reasoning."
  • "What is the most critical factor in [phenomenon] when subjected to in-depth scholarly analysis?"
- Ensure that although the answer is concise and straightforward, the question itself demands deep, multi-step reasoning.
- Place the correct answer as the first option, and leave all other options empty [VERY IMPORTANT AND CRITICAL].
${CRITICAL_DIVERSITY_INSTRUCTIONS}
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
- The distribution of true and false answers MUST be completely random
- Consciously avoid ANY patterns in the true/false distribution
- Each new question's true/false pattern should be entirely independent of other questions
- Treat each option's true/false value as an independent decision
- Do NOT try to "balance" the number of true and false statements across questions
- Options can be all true, all false, or any random combination
- Double-check your question set to ensure no accidental patterns have emerged

${STATEMENT_CREATION_GUIDELINES}

Example of correct formatting and randomization:

Question: "Regarding cellular stress responses and protein regulation:"
Options:
value: "While heat shock proteins are upregulated during thermal stress, their protective effects extend beyond temperature-related protein denaturation" (id: "A", answer: true)
value: "The ubiquitin-proteasome system exclusively targets misfolded proteins for degradation, making it the primary quality control mechanism in cells" (id: "B", answer: false)
value: "Cellular proteostasis networks become permanently impaired following acute oxidative stress, leading to irreversible protein aggregation" (id: "C", answer: false)
value: "The unfolded protein response can paradoxically increase protein synthesis in specific cellular compartments while globally attenuating translation" (id: "D", answer: true)

Note how:
1. Option values contain ONLY the statement text, without any option ID prefixes
2. The IDs (A, B, C, D) are separate from the statements
3. The true/false pattern (TFFT) is unique and doesn't follow any predictable sequence
4. Each subsequent question must have its own independent, random pattern

THIS INSTRUCTION IS CRITICAL FOR MULTIPLE TRUE-FALSE QUESTIONS:
1. ABSOLUTELY NO PATTERNS IN TRUE/FALSE DISTRIBUTION
2. EACH QUESTION'S TRUE/FALSE PATTERN MUST BE INDEPENDENT AND RANDOM
3. CREATE HIGHLY CHALLENGING QUESTIONS WITH OPTIONS THAT TEST DEEP UNDERSTANDING
4. ENSURE FALSE STATEMENTS ARE CREATED BY MAKING SUBTLE, MEANINGFUL CHANGES TO TRUE STATEMENTS FROM THE DOCUMENT
5. DO NOT INCLUDE OPTION IDs (A, B, C, D) IN THE OPTION VALUES - KEEP THEM SEPARATE IN THE ID FIELD`;

const getQuestionStyle = (questionType: QuestionType) => {
  if (questionType === 'Flash Cards') return 'flashcard-style';

  if (questionType === 'Multiple Choice') return 'multiple-choice';

  if (questionType === 'Multiple True-False') return 'multiple true-false';

  if (questionType === 'Oral (Viva)') return 'oral (viva)';
};

const getBasePrompt = (
  questionCount: number,
  focusAreas?: string[],
  questionType?: QuestionType,
): string => `
Analyze the document thoroughly. Generate ${questionCount} unique and new ${getQuestionStyle(
  questionType,
)} questions based on key concepts. ${questionType === 'Oral (Viva)' ? VIVADIFFICULTYPROMPT : DIFFICULTY_PROMPT}

${
  focusAreas?.length
    ? `Focus specifically on these concepts: ${focusAreas.join(', ')}. Create specific, concept-focused questions that test core understanding. Distribute questions evenly across concepts and shuffle their order. QUESTIONS SHOULD SOLELY BE BASED ON THESE CONCEPTS, NO OTHER AREAS WITHIN THE DOCUMENT.`
    : 'Consider the different concepts the document taught within the document and distribute questions evenly across these concepts. Consider concepts not explored in previous questions'
}

${
  !['Flash Cards', 'Oral (Viva)'].includes(questionType)
    ? 'AGAIN, ENSURE THE QUESTIONS AND OPTIONS ARE AT THE HIGHEST DIFFICULTY POSSIBLE. THE OPTIONS SHOULD INCLUDE DISTRACTORS THAT REQUIRE DEEP UNDERSTANDING TO RULE OUT. THE QUESTIONS SHOULD REQUIRE THE READER TO UNDERGO MULTISTEP REASONING AND CRITICAL THINKING.'
    : ''
}

${
  !focusAreas?.length
    ? 'Ensure questions are not repetitive, explore the document extensively and produce questions from different areas within the document. DO NOT FOCUS QUESTIONS ON A SMALL AREA. EXPLORE THE WHOLE DOCUMENT AND GIVE QUESTIONS FROM DIFFERENT AREAS WITHIN THE DOCUMENT.'
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
    ? '4. For Multiple True-False questions:\n   - Include the "answer" field for each option, set to either true or false\n   - Keep the true/false distribution COMPLETELY RANDOM with NO PATTERNS\n   - DO NOT include option IDs (A, B, C, D) in the option values'
    : ''
}`;

// Main generator function
export const generatePromptForQuestions = ({
  questionCount = 5,
  focusAreas,
  includeCaseStudies = false,
  questionType = 'Multiple Choice',
}: PromptConfig): string => {
  const basePrompt = getBasePrompt(questionCount, focusAreas, questionType);
  const specificPrompt = getSpecificPrompt(questionType, includeCaseStudies);
  const jsonFormat = getJsonFormat(questionType);

  return `
${basePrompt}
${specificPrompt}
${getFormatRules(questionType)}

Ignore images. Return only a JSON array in this format:
${jsonFormat}

If unable to generate questions, return "unable to generate questions".`;
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
- If a student asks questions about the exam or document, politely say you cannot answer and encourage them to focus on their response.

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
): string => {
  if (questionType === 'Flash Cards') return getFlashCardPrompt();
  if (questionType === 'Multiple True-False')
    return getMultipleTrueFalsePrompt();
  if (questionType === 'Oral (Viva)') return getOralQuestionPrompt();
  return includeCaseStudies
    ? getCaseStudyPrompt()
    : getDirectQuestionPrompt(questionType);
};

export const getOralExaminationTranscriptAnalysisPrompt = (transcript: string): string => {
  return `
  # Oral Examination Analysis Task

  ## Instructions:
  1. First, thoroughly review the reference document attached to this conversation thread. This document contains the authoritative information against which you must evaluate all student answers.
  
  2. Identify only the academic test questions in the transcript below (ignore greetings, small talk, and closing remarks).
  
  3. For each identified question:
     - Determine the expected correct answer based EXCLUSIVELY on the attached reference document
     - Extract the student's actual response from the transcript
     - Perform a rigorous comparison between the student's answer and the information in the attached document
     - Craft a detailed, evidence-based analysis with direct quotations from the reference document when relevant
  
  4. Apply strict scoring criteria (0-10) based on accuracy, completeness, and precision in relation to the reference document.

  ## System Analysis Requirements:
  - Address the student directly using "you" and "your" (e.g., "You demonstrated good understanding of...")
  - Begin with positive observations about what the student did correctly
  - Follow with specific areas for improvement, citing exact information from the reference document
  - Include direct quotes from the reference document to support your analysis
  - Be encouraging but honest about shortcomings
  - Provide concrete suggestions for improvement
  - Keep the overall tone supportive while maintaining evaluative rigor
  - Be thorough in your analysis but avoid unnecessary length
  
  ## Scoring Guidelines:
  - Apply strict standards when scoring
  - Perfect scores (10/10) should be rare and only given for answers that align perfectly with the reference document
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
      "systemAnalysis": "Your detailed, evidence-based analysis speaking directly to the student, with specific references to the attached document",
      "score": number (between 0-10, applying strict standards)
    }
  ]

  Important rules:
  - Base all evaluations EXCLUSIVELY on the attached reference document
  - Include ONLY academic test questions in your analysis
  - Use "no-answer" (lowercase, hyphenated) when the student doesn't provide a substantive response
  - Ensure your analysis is specific, evidence-based, and cites the reference document
  - Maintain an encouraging tone while being honest about shortcomings
  - Apply strict scoring standards
  - Ensure the output is valid JSON with the exact structure specified above

  ## Transcript to Analyze:
  ${transcript}
  `
};