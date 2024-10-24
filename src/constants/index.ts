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
${focusAreas?.length ? `Focus on these concepts: ${focusAreas.join(', ')}. Create specific, concept-focused questions that test core understanding. ${focusAreas.length > 1 ? 'Distribute questions evenly across concepts and shuffle their order.' : ''}` : ''}
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
  [Previous flashcard content remains the same...]`;

const multipleTrueFalsePrompt = `9. CRITICAL: For Multiple True-False questions, adhere to these guidelines to create challenging, thought-provoking questions that test deep understanding and attention to detail:

EXTREMELY IMPORTANT - TRUE/FALSE DISTRIBUTION:
- The distribution of true and false answers MUST be completely random
- Consciously avoid ANY patterns in the true/false distribution (like alternating true/false or having the same number of each)
- Each new question's true/false pattern should be entirely independent of other questions
- Treat each option's true/false value as an independent decision
- Do NOT try to "balance" the number of true and false statements across questions
- Options can be all true, all false, or any random combination
- Double-check your question set to ensure no accidental patterns have emerged

  - Craft a complex stem that introduces a multifaceted concept or scenario from the document
  - Provide 4 nuanced statements related to the stem, each requiring careful evaluation as true or false
  - Ensure statements are based on document information but require synthesis, analysis, or application of knowledge

  - When creating options:
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

Example of highly challenging Multiple True-False question with RANDOM true/false distribution:

Regarding cellular stress responses and protein regulation:
A. While heat shock proteins are upregulated during thermal stress, their protective effects extend beyond temperature-related protein denaturation (True)
B. The ubiquitin-proteasome system exclusively targets misfolded proteins for degradation, making it the primary quality control mechanism in cells (False)
C. Cellular proteostasis networks become permanently impaired following acute oxidative stress, leading to irreversible protein aggregation (False)
D. The unfolded protein response can paradoxically increase protein synthesis in specific cellular compartments while globally attenuating translation (True)

Note how the true/false pattern (TFFT) is unique and doesn't follow any predictable sequence. Each subsequent question should have its own independent, random pattern.

THIS INSTRUCTION IS CRITICAL FOR MULTIPLE TRUE-FALSE QUESTIONS:
1. ABSOLUTELY NO PATTERNS IN TRUE/FALSE DISTRIBUTION
2. EACH QUESTION'S TRUE/FALSE PATTERN MUST BE INDEPENDENT AND RANDOM
3. CREATE HIGHLY CHALLENGING QUESTIONS WITH OPTIONS THAT TEST DEEP UNDERSTANDING
4. ENSURE FALSE STATEMENTS ARE CREATED BY MAKING SUBTLE, MEANINGFUL CHANGES TO TRUE STATEMENTS FROM THE DOCUMENT`;

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

For each question, the options should be either A, B, C or D consecutively.
${questionType === 'Flash Cards' ? 'For flashcards, include only one option with the correct answer, and set its ID as the correctAnswerId. Leave other options empty.' : ''}
${questionType === 'Multiple True-False' ? 'For Multiple True-False questions, include the "answer" field for each option, set to either true or false. Remember to keep the true/false distribution COMPLETELY RANDOM with NO PATTERNS.' : ''}
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

export const defaultPageSize = 10;

export const defaultPageNumber = 1;
