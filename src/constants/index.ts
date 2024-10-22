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
4. ${questionType === 'Flash Cards' ? 'Focus on strengthening memorization of key facts, terms, or concepts' : questionType === 'Multiple True-False' ? 'Ensure a mix of true and false statements, with at least one of each' : 'Create plausible but clearly incorrect alternatives'}
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

const multipleTrueFalsePrompt = `9. CRITICAL: For Multiple True-False questions, adhere to these guidelines to create challenging, thought-provoking questions that test deep understanding and attention to detail:

  - Craft a complex stem that introduces a multifaceted concept or scenario from the document
  - Provide 4 nuanced statements related to the stem, each requiring careful evaluation as true or false
  - Ensure statements are based on document information but require synthesis, analysis, or application of knowledge
  - Include a mix of true and false statements, avoiding obvious patterns
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

Examples of highly challenging Multiple True-False questions with subtle, detail-oriented options:

1. Regarding the regulation of cellular metabolism:
  A. While AMPK activation typically increases glucose uptake in skeletal muscle, this effect is attenuated in the presence of chronic insulin resistance, though not completely abolished
  B. The rate-limiting step of fatty acid oxidation is regulated by CPT-1, yet its activity is paradoxically enhanced in states of metabolic inflexibility
  C. Mitochondrial fusion proteins, particularly Mfn2, coordinate with PGC-1α to regulate oxidative capacity, although this relationship becomes inversely correlated during cellular stress
  D. Although ROS production increases exponentially during states of nutrient excess, the adaptive unfolded protein response initially compensates through a NOX4-dependent mechanism


2. Concerning the pathophysiology and treatment of heart failure:
   A. Beta-blockers are contraindicated in acute decompensated heart failure due to their negative inotropic effects, but are essential in chronic heart failure management
   B. The PARADIGM-HF trial demonstrated that sacubitril/valsartan was superior to enalapril in reducing cardiovascular death in patients with heart failure with preserved ejection fraction
   C. Cardio-renal syndrome type 1 refers to acute kidney injury secondary to acute decompensated heart failure, while type 2 refers to chronic kidney disease as a result of chronic heart failure
   D. In advanced heart failure, pulmonary artery pressure-guided therapy has been shown to reduce heart failure hospitalizations but not overall mortality

Key Features Demonstrated:
- Each statement contains multiple concepts that must be evaluated
- Uses precise scientific terminology
- Includes qualifying conditions that affect truth value
- Requires deep understanding of mechanisms
- Contains subtle but critical details
- Challenges typical assumptions
- Demands careful analysis of each component

THIS INSTRUCTION IS CRITICAL FOR MULTIPLE TRUE-FALSE QUESTIONS - STRICTLY ADHERE TO CREATING HIGHLY CHALLENGING QUESTIONS WITH OPTIONS THAT TEST DEEP UNDERSTANDING AND ATTENTION TO DETAIL. ENSURE THAT FALSE STATEMENTS ARE CREATED BY MAKING SUBTLE, MEANINGFUL CHANGES TO TRUE STATEMENTS FROM THE DOCUMENT.`;

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
${questionType === 'Multiple True-False' ? 'For Multiple True-False questions, include the "answer" field for each option, set to either true or false.' : ''}
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
