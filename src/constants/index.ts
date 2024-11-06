import { MessageReponseType } from 'src/infra/web/models/MessageResponseTypeModel';
import { QuestionType } from 'src/infra/web/models/QuestionTypeModel';

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
  const basePrompt = `Analyze the document thoroughly. Generate ${questionCount} unique ${questionType === 'Flash Cards' ? 'flashcard-style' : questionType === 'Multiple True-False' ? 'multiple true-false' : 'multiple-choice'} questions based on key concepts. Before generating each question Double-check each question and its options against the document to ensure absolute accuracy while maintaining high difficulty.
${focusAreas?.length ? `Focus on these concepts: ${focusAreas.join(', ')}. Create specific, concept-focused questions that test core understanding. ${focusAreas.length > 1 ? 'Distribute questions evenly across concepts and shuffle their order.' : ''}` : ''} IMPORTANT: ENSURE YOU GENERATE ${questionCount}   QUESTIONS!
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
THIS INSTRUCTION IS CRITICAL FOR ALL QUESTIONS - STRICTLY ADHERE TO CREATING SCENARIO-BASED QUESTIONS THAT APPLY DOCUMENT CONCEPTS.`;

  const directQuestionPrompt = `8. IMPORTANT: Generate ONLY direct, concept-based questions. DO NOT use any scenarios, case studies, or hypothetical situations.
   - Questions should test specific knowledge, definitions, principles, or facts directly from the document
   - Focus on key terms, processes, classifications, or theoretical concepts
   - Use formats like ${questionType === 'Flash Cards' ? '"What is...", "Define...", "Name...", "Identify..."' : questionType === 'Multiple True-False' ? '"Which of the following statements are true regarding...?", "Evaluate the following statements about..."' : '"Which of the following best describes...?", "How does X differ from Y?", "What is...", "Identify...", "Which of the following..."'}
   - Avoid any patient scenarios or clinical vignettes
   - Questions should be straightforward and assess factual recall or conceptual understanding
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
  - Place the correct answer as the first option, and leave other options empty

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
[
  {
    "id": "string",
    "question": "string",
    "options": [
      ${questionType === 'Multiple True-False' ? '{ "value": "string", "id": "string", "answer": boolean }' : '{ "value": "string", "id": "string" }'}
    ],
    ${questionType !== 'Multiple True-False' ? '"correctAnswerId": "string",' : ''}
    "explanation": "string",
    "hint": "string"
  }
]

IMPORTANT FORMAT RULES:
1. For each question, the options' IDs should be A, B, C, or D consecutively
2. The option "value" field should contain ONLY the statement text, without any option ID prefixes
3. ${questionType === 'Flash Cards' ? 'For flashcards, include only one option with the correct answer, and set its ID as the correctAnswerId. Leave other options empty.' : ''}
4. ${questionType === 'Multiple True-False' ? 'For Multiple True-False questions:\n   - Include the "answer" field for each option, set to either true or false\n   - Keep the true/false distribution COMPLETELY RANDOM with NO PATTERNS\n   - DO NOT include option IDs (A, B, C, D) in the option values' : ''}

If unable to generate questions, return "unable to generate questions".`;

  return finalPrompt;
};

export const generateTopicPrompt = `
Please review the document, and understand thoroughly what the document is about deeply and in detail. Then, determine if it is divided into detailed distinct topics, chapters or content covering various specific concepts in the document. Check if the broad concepts or chapters or topics are further broken down into specific concepts or topics. If it is, extract and return all the specific topics. If not, analyze the document, identify different specific concepts or topics, and return them. Ensure that they are detailed, touching on specific concepts and not a broad overview.

Output the result in the following JSON format:

["title1", "title2", ... ]

Provide only the JSON array, nothing else. Be detailed and fast`;

export const generateMessagePrompt = (
  message: string,
  responseFormat: MessageReponseType,
) => {
  return `
${message}

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

export const defaultPageSize = 10;

export const defaultPageNumber = 1;
