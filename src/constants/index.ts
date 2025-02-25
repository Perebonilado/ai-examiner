import { NotSureQuestion } from 'src/dto/CreateDocumentMessageDto';
import { MessageReponseType } from 'src/infra/web/models/MessageResponseTypeModel';
import { QuestionType } from 'src/infra/web/models/QuestionTypeModel';
import {
  FloDeskSegmentKeys,
  FloDeskSegmentModel,
} from 'src/integrations/flo-desk-mailer/models/FloDeskSegmentModel';

export const saltRounds = 10;

export const maxNumberOfQuestionGenerationForFreePlanTier = 2;

export const inactiveSubscriptionStatuses = [
  'completed',
  'cancelled',
  'attention',
];

export const generateQuestionsPrompt = (
  questionCount: number = 5,
  focusAreas?: string[],
  includeCaseStudies = false,
  questionType: QuestionType = 'Multiple Choice',
) => {
  const basePrompt = `Analyze the document thoroughly. Generate ${questionCount} unique and new ${questionType === 'Flash Cards' ? 'flashcard-style' : questionType === 'Multiple True-False' ? 'multiple true-false' : 'multiple-choice'} questions based on key concepts. ENSURE THAT EVERY QUESTION IS VERY DIFFICULT TO ANSWER. THE KIND OF DIFFICULTY THAT A COLLEGE PROFESSOR WOULD FIND CHALLENGING. THE QUESTIONS SHOULD REQUIRE THE USER TO HAVE A LONG TRAIN OF THOUGHTS BEFORE FIGURING OUT THE ANSWER FROM THE OPTIONS. Before generating each question Double-check each question and its options against the document to ensure absolute accuracy while maintaining high difficulty. Ensure questions are new and differ from previously generated questions. 
${focusAreas?.length ? `Focus specifically on these concepts: ${focusAreas.join(', ')}. Create specific, concept-focused questions that test core understanding. Distribute questions evenly across concepts and shuffle their order. QUESTIONS SHOULD SOLELY BE BASED ON THESE CONCEPTS, NO OTEHER AREAS WITHIN THE DOCUMENT.` : 'Consider the differenct concepts the document taught within the document and distribute questions evenly across these concepts. Consider concepts not explored in previous questions'}. 
${questionType !== 'Flash Cards' ? 'AGAIN, ENSURE THE QUESTIONS AND OPTIONS ARE AT THE HIGHEST DIFFICULTY POSSIBLE. THE OPTIONS SHOULD INCLUDE DISTRACTORS THAT REQUIRE DEEP UNDERSTANDING TO RULE OUT. THE QUESTIONS SHOULD REQUIRE THE READER TO UNDERGO MULTISTEP REASONING AND CRITICAL THINKING.' : ''}. ${!focusAreas?.length ? 'Ensure questions are not repititive, explore the document extensively and produce questions from different areas within the document. DO NOT FOCUS QUESTIONS ON A SMALL AREA. EXPLORE THE WHOLE DOCUMENT AND GIVE QUESTIONS FROM DIFFERENT AREAS WITHIN THE DOCUMENT.' : ''}
TOPIC TAGGING INSTRUCTIONS [VERY IMPORTANT]:
- ${focusAreas?.length ? 'Tag each question PRECISELY to the specific focus area it covers' : 'IDENTIFY and TAG each question with the most appropriate topic from the document'}
- Topic tags should be EXTREMELY PRECISE and DIRECTLY RELATED to the question's content
- Use concise, specific topic names that clearly indicate the exact concept being tested
- Ensure each question is tagged to ONLY ONE primary topic
${!focusAreas?.length ? '- Ensure that topics are broad concepts within the document that the question touches on.' : ''}

For each question:
1. Ensure relevance to document content
2. Provide 4 options with unique IDs${questionType === 'Flash Cards' ? ', with the correct answer as the first option' : ''}
3. ${questionType === 'Flash Cards' ? 'For flashcards, include only one correct answer as the first option, and leave the other options empty' : questionType === 'Multiple True-False' ? 'For each option, determine if it is true or false based on the document content' : 'Include one correct answer; vary its position'}
4. ${questionType === 'Flash Cards' ? 'Focus on strengthening memorization of key facts, terms, or concepts' : questionType === 'Multiple True-False' ? 'Ensure a RANDOM mix of true and false statements - avoid ANY patterns in true/false distribution' : 'Create plausible but clearly incorrect alternatives'}
5. Add a hint that aids recall without revealing the answer
6. Include a detailed explanation. ${questionType === 'Flash Cards' ? 'Explain why the answer is correct and provide context' : questionType === 'Multiple True-False' ? 'Explain why each option is true or false' : 'Explain why the correct option is the answer and why the incorrect options are not'}
7. Ensure the questions and options are ${questionType === 'Flash Cards' ? 'clear, concise, and promote effective memorization' : 'difficult and thought provoking'}`;

  const caseStudyPrompt = `8. IMPORTANT: Create questions based on realistic clinical scenarios that apply concepts from the document.
   - Begin each question with a brief patient case or clinical situation
   - Ensure the scenario is directly relevant to the document's content
   - Include key details such as patient demographics, presenting symptoms, or test results as appropriate
   - Frame the question to test application of knowledge, clinical reasoning, or decision-making
   - Scenarios should be concise but provide enough context for the question
   - Vary the types of scenarios (e.g., diagnosis, treatment planning, interpretation of results)
   - Ensure that answering the question requires understanding and applying concepts from the document
   - Avoid overly complex or rare clinical situations unless specifically relevant to the document's focus
   - CRITICAL: Vary the position of the correct answer within the options. If the first question has A at it's correct option, the next question may have D as its correct option. Ensure this is varied. THERE SHOULD BE NO PATTERN, THERE SHOULD BE AN UNEVEN DISTRIBUTION OF EITHER A, B, C OR D AS THE CORRECT OPTION. HOWEVER, EACH QUESTION SHOULD HAVE AT LEAST ONE AS ITS CORRECT OPTION. THIS IS COMPULSORY AND NON-NEGOTIABLE.
THIS INSTRUCTION IS CRITICAL FOR ALL QUESTIONS - STRICTLY ADHERE TO CREATING SCENARIO-BASED QUESTIONS THAT APPLY DOCUMENT CONCEPTS.`;

  const directQuestionPrompt = `8. IMPORTANT: Generate ONLY direct, concept-based questions. DO NOT use any scenarios, case studies, or hypothetical situations.
   - Questions should test specific knowledge, definitions, principles, or facts directly from the document
   - Focus on key terms, processes, classifications, or theoretical concepts
   - Use formats like ${questionType === 'Flash Cards' ? '"What is...", "Define...", "Name...", "Identify..."' : questionType === 'Multiple True-False' ? '"Which of the following statements are true regarding...?", "Evaluate the following statements about..."' : '"Which of the following best describes...?", "How does X differ from Y?", "What is...", "Identify...", "Which of the following..."'}
   - Avoid any patient scenarios or clinical vignettes
   - Questions should be straightforward and assess factual recall or conceptual understanding
   - CRITICAL: Vary the position of the correct answer within the options. If the first question has A at it's correct option, the next question may have D as its correct option. Ensure this is varied. THERE SHOULD BE NO PATTERN, THERE SHOULD BE AN UNEVEN DISTRIBUTION OF EITHER A, B, C OR D AS THE CORRECT OPTION. HOWEVER, EACH QUESTION SHOULD HAVE AT LEAST ONE AS ITS CORRECT OPTION. THIS IS COMPULSORY AND NON-NEGOTIABLE.
THIS INSTRUCTION IS CRITICAL - STRICTLY ADHERE TO CREATING ONLY DIRECT QUESTIONS WITHOUT ANY SCENARIOS.`;

  const flashCardPrompt = `9. IMPORTANT: For flashcard questions, focus on the following:
  - Create questions that typically have one-word or very short phrase answers
  - Focus on key terms, definitions, important dates, or fundamental concepts
  - Use varied and specific question formats, such as:
    • "The [term/concept] responsible for [function/process] is..."
    • "[Term/concept] is defined as..."
    • "[Person] is best known for..."
    • "The [anatomical structure] is located in..."
    • "The function of [organ/structure] is..."
    • "The [chemical element] with the symbol [symbol] is..."
    • "[Process] occurs in which part of the [larger system]?"
    • "The [law/theory] states that..."
    • "What is the primary cause of [condition/phenomenon]?"
  - Ensure questions are concise and directly test recall of specific information
  - Answers should be brief and precise, promoting quick memorization
  - Vary question types to cover different aspects of memorization (e.g., term to definition, definition to term, cause to effect)
  - Place the correct answer as the first option, and leave other options empty [VERY IMPORTANT AND CRITICAL]

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

  const multipleTrueFalsePrompt = `9. CRITICAL: For Multiple True-False questions, adhere to these guidelines to create challenging, thought-provoking questions that test deep understanding and attention to detail:

EXTREMELY IMPORTANT - TRUE/FALSE DISTRIBUTION:
- The distribution of true and false answers MUST be completely random
- Consciously avoid ANY patterns in the true/false distribution (like alternating true/false or having the same number of each)
- Each new question's true/false pattern should be entirely independent of other questions
- Treat each option's true/false value as an independent decision
- Do NOT try to "balance" the number of true and false statements across questions
- Options can be all true, all false, or any random combination
- Double-check your question set to ensure no accidental patterns have emerged

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
   • Challenge common misconceptions with nuanced statements

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

  const finalPrompt = `${basePrompt}
${questionType === 'Flash Cards' ? flashCardPrompt : questionType === 'Multiple True-False' ? multipleTrueFalsePrompt : includeCaseStudies ? caseStudyPrompt : directQuestionPrompt}

Ignore images. Return only a JSON array in this format:
${
  questionType === 'Flash Cards'
    ? `
  [
  {
    "id": "string",
    "question": "string",
    "options": [
      { "value": "string", "id": "string" }  
    ] // THIS WILL HAVE A LENGTH OF ONLY 1 AND THAT ONE OBJECT WILL HOLD THE CORRECT INFORMATION TO THE QUESTION. JUST ONE OBJECT WITH THE RIGHT OPTION!!! VERY IMPORTANT,
    "explanation": "string",
    "hint": "string",
    "topic": "string"
  }
]
  `
    : `
[
  {
    "id": "string",
    "question": "string",
    "options": [
      ${questionType === 'Multiple True-False' ? '{ "value": "string", "id": "string", "answer": boolean }' : '{ "value": "string", "id": "string" }'}
    ],
    ${questionType !== 'Multiple True-False' ? '"correctAnswerId": "string",' : ''}
    "explanation": "string",
    "hint": "string",
    "topic": "string"
  }
]`
}


IMPORTANT FORMAT RULES:
1. For each question, the options' IDs should be A, B, C, or D consecutively
2. The option "value" field should contain ONLY the statement text, without any option ID prefixes
3. Ensure EVERY question is tagged with a topic. THIS IS VERY IMPORTANT AND NON-NEGOTIABLE
4. ${questionType === 'Multiple True-False' ? 'For Multiple True-False questions:\n   - Include the "answer" field for each option, set to either true or false\n   - Keep the true/false distribution COMPLETELY RANDOM with NO PATTERNS\n   - DO NOT include option IDs (A, B, C, D) in the option values' : ''}

If unable to generate questions, return "unable to generate questions".`;

  return finalPrompt;
};

export const generateTopicPrompt = `
Please review the document, and understand thoroughly what the document is about deeply and in detail. Then, determine if it is divided into detailed distinct topics, chapters or content covering various specific concepts in the document. Check if the broad concepts or chapters or topics are further broken down into specific concepts or topics. If it is, extract and return all the specific topics. If not, analyze the document, identify different specific concepts or topics, and return them. Ensure that they are detailed, touching on specific concepts and not a broad overview.

Output the result in the following JSON format:

["title1", "title2", ... ]

Provide only the JSON array, nothing else. Be detailed and fast`;

const optionLetters = ['a', 'b', 'c', 'd']

export const messagePromptPrefixGenerator = (question: NotSureQuestion) => {
  if (question.questionType === 'Multiple Choice') {
    return `
      TAKE A DEEP BREATH, RELAX, AND GO THROUGH THE INSTRUCTIONS BELOW VERY CAREFULLY.

      I need help picking the right answer for the following question. I was presented with the following options and only one of the answers is correct.

      Here is the question: ${question.question}

      Here are the options - 
      ${question.options.map((q, i) => `${optionLetters[i]}. ${q}`).join('\n')}

      \n
      I need you to thoroughly go through each option, evaluate each very indepthly. Then, work out and reason by going through the documen to deduce 
      whether each option is correct or wrong. For each option, explain why it is wrong or correct. Explain it to me like I am 12. Meaning, in very simple terms, break it
      down for me. You may support it with excerpts (verbatim) from the document to buttress your points. Let me know if there are things about each option that may cause me
      to mistake it for the right answer when it is indeed wrong. 

      I need you to first tell me which option is correct, then below that, give your explanations. BUT LET ME KNOW WHICH IS CORRECT FIRST!

      IMPORTANT: DO NOT CITE SOURCE IN YOUR RESPONSE
    `;
  }

  if (question.questionType === 'Multiple True-False') {
    return `
      TAKE A DEEP BREATH, RELAX, AND GO THROUGH THE INSTRUCTIONS BELOW VERY CAREFULLY.

      I need help picking the right answer for the following question. I was presented with the following statements. I need you to deeply evaluate each statement and let me know
      if each is right or wrong. I need to to reason this out before letting me know. Thoroughly go through the document and see why each statement might be right or wrong.
      I need you to explain this to me like I am 12. I need you to break it down for me and make it very simple. Let me know if there are tricky things in each statement that
      might cause it to look like its right when indeed it might be wrong or not the best option. Each statement might be true or false, so you need to evaluate each closely. You may support
      you explanation with short excerpts from the document.

      I NEED YOU TO LET ME KNOW WHICH STATEMENTS ARE RIGHT AND WHICH STATEMENTS ARE WRONG FIRST. THEN BELOW THAT, GIVE YOUR EXPLANATIONS.

      IMPORTANT: DO NOT CITE SOURCE IN YOUR RESPONSE
    `;
  }

  return question.question;
};

export const generateMessagePrompt = ({
  message,
  responseFormat,
  prefix,
}: {
  message: string;
  responseFormat: MessageReponseType;
  prefix: string;
}) => {
  return `
${prefix.length ? prefix : message}

Format the response as follows:
   - Use markdown format
   - Start each heading and bullet point on a new line, adding spaces between each line
   - Do not include any HTML tags
   - Do not cite sources
   - Do not add any markdowns that translate to <code></code> in html
   - Do not repeat the request message, omit this in your response
`;
};

export const generateSourceInfoPrompt = (question: string) => {
  return `
  Analyze every aspect of this question thoroughly: ${question}

Your task is to:
1. Find ALL paragraphs that contain information relevant to:
   - Key terms mentioned in the question
   - The subject matter being discussed
   - Related concepts and context

2. Present your findings in this exact format:

Question: [Paste the exact question]

SOURCE TEXT:
[Present paragraphs in order of relevance to the question's key terms and concepts:
- The paragraph containing the strongest match to the question's key terms MUST appear first
- Follow with other relevant paragraphs that contain supporting information
- Use **bold text** within each paragraph to highlight key terms that match or relate to the question

Separate each paragraph with a blank line]

Format Rules:
- Present paragraphs exactly as they appear in the document
- Order by relevance to the question's specific terminology and focus
- Remove any citation markers or reference tags
- Use only markdown bold (**) for highlighting
- Do not add explanations or analysis
- Do not include HTML tags or code blocks
- Do not modify or rearrange the text within paragraphs

Note: Like a search engine, the most relevant paragraph (containing the closest match to the question's main ask) should appear first.
`;
};

export const generatePerformanceTrackingPrompt = (
  questions: {
    question: string;
    answeredCorrectly: boolean;
  }[],
) => {
  return `
  Follow the steps laid out below very strictly.
  
  Steps:
  1. Please review the document, and understand thoroughly what the document is about deeply and in detail. Then, determine if it is divided into detailed distinct topics, chapters or content covering various specific concepts in the document. Check if the broad concepts or chapters or topics are further broken down into specific concepts or topics. If it is, extract and return all the specific topics. If not, analyze the document, identify different specific concepts or topics, and return them. Ensure that they are detailed, touching on specific concepts and not a broad overview.

  2. Using the questions provided below, group each into its most appropriate topic.

  3. Calculate topic-specific performance using:
     Percentage Correct = (Correctly Answered Questions / Total Topic Questions) * 100. Round off to 2 decimal places

  4. Based on the score for each topic, provide a recommendation on ways the student can improve. Be practical about this stating specific areas in the document that the student can focus on to improve on that topic. Give examples of questions (not statements) that they failed and small excerpts pointing to areas in the document that they can study to do better. These excerpts need to be verbatim, as it is in the document.

     Recommendation Guidelines:
     - Recommend ONLY study practices from these types: multiple choice, multiple true false, and flash cards
     - Match recommended practice type to specific learning needs of each topic
     - Explain brief rationale for why this practice type will help address performance gaps
  
  5. Output Requirements. Return only this JSON structure based on the data you provide. Only this structure below and nothing else.
   Strict JSON Structure:
   [[topic, percentageCorrect, "Insights-driven improvement recommendation"]]
     

Questions:
${questions}



REMEMBER, MANDATORY OUTPUT FORMAT:

   [[topic, percentageCorrect, "Insights-driven improvement recommendation"]]

  `;
};

export const defaultPageSize = 10;

export const defaultPageNumber = 1;

export const FloDeskSegments: Record<FloDeskSegmentKeys, FloDeskSegmentModel> =
  {
    newSubscribers: {
      id: '672f779aa31d3077e11aca54',
      name: 'NEW SIGN UP',
    },
  };
