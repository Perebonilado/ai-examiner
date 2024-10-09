import { MessageReponseType } from 'src/infra/web/models/MessageResponseTypeModel';

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
  isFlashCard = false,
) => {
  const basePrompt = `Analyze the document thoroughly. Generate ${questionCount} unique ${isFlashCard ? 'flashcard-style' : 'multiple-choice'} questions based on key concepts. Before generating each question Double-check each question and its options against the document to ensure absolute accuracy while maintaining high difficulty.
${focusAreas?.length ? `Focus on these concepts: ${focusAreas.join(', ')}. Create specific, concept-focused questions that test core understanding. ${focusAreas.length > 1 ? 'Distribute questions evenly across concepts and shuffle their order.' : ''}` : ''}
For each question:
1. Ensure relevance to document content
2. Provide 4 options with unique IDs${isFlashCard ? ', with the correct answer as the first option' : ''}
3. ${isFlashCard ? 'For flashcards, include only one correct answer as the first option, and leave the other options empty' : 'Include one correct answer; vary its position'}
4. ${isFlashCard ? 'Focus on strengthening memorization of key facts, terms, or concepts' : 'Create plausible but clearly incorrect alternatives'}
5. Add a hint that aids recall without revealing the answer
6. Include a detailed explanation. ${isFlashCard ? 'Explain why the answer is correct and provide context' : 'Explain why the correct option is the answer and why the incorrect options are not'}
7. Ensure the questions and options are ${isFlashCard ? 'clear, concise, and promote effective memorization' : 'difficult and thought provoking'}`;

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
   - Use formats like ${isFlashCard ? '"What is...", "Define...", "Name...", "Identify..."' : '"Which of the following best describes...?", "How does X differ from Y?", "What is...", "Identify...", "Which of the following..."'}
   - Avoid any patient scenarios or clinical vignettes
   - Questions should be straightforward and assess factual recall or conceptual understanding
THIS INSTRUCTION IS CRITICAL - STRICTLY ADHERE TO CREATING ONLY DIRECT QUESTIONS WITHOUT ANY SCENARIOS.`;

const flashCardPrompt = `9. IMPORTANT: For flashcard questions, focus on the following:
- Create questions that typically have one-word or very short phrase answers
- Focus on key terms, definitions, important dates, or fundamental concepts
- Use varied and specific question formats, such as:
  • "The [term/concept] responsible for [function/process] is..."
  • "[Term/concept] is defined as..."
  • "In [year], [event] occurred. This event is known as..."
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
- Place the correct answer as the first option, and leave the other options empty

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
- Keep track of the questions you've generated to avoid repetition

Examples of diverse flashcard-style questions:
1. Q: The process of converting light energy into chemical energy in plants is called...
   A: Photosynthesis
2. Q: Homeostasis is defined as...
   A: The maintenance of a stable internal environment
3. Q: The Krebs cycle occurs in which cellular organelle?
   A: Mitochondria
4. Q: Who proposed the theory of evolution by natural selection?
   A: Charles Darwin
5. Q: The hormone responsible for regulating blood sugar levels is...
   A: Insulin

THIS INSTRUCTION IS CRITICAL FOR FLASHCARD QUESTIONS - STRICTLY ADHERE TO CREATING DIVERSE, UNIQUE, AND MEMORIZATION-FOCUSED QUESTIONS AND ANSWERS.`;

  const finalPrompt = `${basePrompt}
${isFlashCard ? flashCardPrompt : includeCaseStudies ? caseStudyPrompt : directQuestionPrompt}

Ignore images. Return only a JSON array in this format:
[
  {
    "id": "string",
    "question": "string",
    "options": [
      { "value": "string", "id": "string" }
    ],
    "correctAnswerId": "string",
    "explanation": "string",
    "hint": "string"
  }
]
${isFlashCard ? 'For flashcards, include only one option with the correct answer, and set its ID as the correctAnswerId. Leave other options empty.' : ''}
If unable to generate questions, return "unable to generate questions".`;

  return finalPrompt;
};

export const generateTopicPrompt = `
Please review the document, and understand thoroughly what the document is about deeply and in detail. Then, determine if it is divided into detailed distinct topics, chapters or content covering various specific concepts in the document. Check if the broad concepts or chapters or topics are further broken down into specific concepts or topics. If it is, extract and return all the specific topics. If not, analyze the document, identify different specific concepts or topics, and return them. Ensure that they are detailed, touching on specific concepts and not a broad overview.

Output the result in the following JSON format:

["title1", "title2", ... ]

Provide only the JSON array, nothing else. Be detailed and fast`;

const summaryResponse = `
1. Evaluate the request above thoroughly.
2. Evaluate what the detailed response to the request is, however, summarize your thoughts and make it concise, get right to the point and address only the focal point of the request.
3. Your response should typically be a few lines, you may add more if necessary to pass across the point. 
4. Do not provide memorization tips or mnemoics.
4. Format the response as follows:
   - Use markdown format
   - Start each heading and bullet point on a new line, adding spaces between each line
   - Do not include any HTML tags
   - Do not cite sources
   - Do not repeat the request message, omit this in your response

`;

const inDepthResponse = `
1. Evaluate what the detailed response to the request is, however, summarize your thoughts.
2. Simplify your response to make it understandable for the reader. Give relatable real life examples to buttress your explanations where possible.
3. Provide mnemonics and patterns that might help the reader memorize or remember better where possible.
4. Format the response as follows:
   - Use markdown format
   - Start each heading and bullet point on a new line, adding spaces between each line
   - Do not include any HTML tags
   - Do not cite sources
   - Do not repeat the request message, omit this in your response
`;

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

export const defaultPageSize = 10;

export const defaultPageNumber = 1;
