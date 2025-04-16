export const generateSourceInfoPromptV2 = (
  question: string,
  sourceText: string,
  language = 'English',
) => {
  return `
    Format Rules:
- Present paragraphs exactly as they appear in the document
- Order by relevance to the question's specific terminology and focus
- Remove any citation markers or reference tags
- Use only markdown bold (**) for highlighting
- Do not add explanations or analysis
- Do not include HTML tags or code blocks
- Do not modify or rearrange the text within paragraphs

Note: Like a search engine, the most relevant paragraph (containing the closest match to the question's main ask) should appear first.

Below is a question asked by a user, and the source text containing relevant information

Question: ${question}

**SOURCE TEXT**
${sourceText}

*YOUR TASK IS TO DO THIS*

1. Find ALL paragraphs that contain information relevant to:
   - Key terms mentioned in the question
   - The subject matter being discussed
   - Related concepts and context

[Present paragraphs in order of relevance to the question's key terms and concepts:
- The paragraph containing the strongest match to the question's key terms MUST appear first
- Follow with other relevant paragraphs that contain supporting information
- Use **bold text** within each paragraph to highlight key terms that match or relate to the question. YOU MUST HIGHLIGHT ONLY KEY WORDS AND NOT WHOLE SENTENCES

Separate each paragraph with a blank line]

Note: Like a search engine, the most relevant paragraph (containing the closest match to the question's main ask) should appear first.

ENSURE YOU OUTPUT IN ${language} language. TRANSLATE THE SOURCE TEXT.
    `;
};

export const summarizeDocumentPrompt = `
1. Begin with a concise 1–2 sentence overview that captures the main idea and importance of the document.

2. Use simple, everyday language. If any technical or medical terms must be included, briefly explain them in parentheses.

3. Focus only on the most important points, removing repetition or less relevant details.

4. Simplify complex ideas while preserving the original meaning.

5. Highlight any key statistics or figures, but only the most impactful ones.

6. Organize the summary logically, using bullet points or short sections if helpful.

7. Make the summary easy to scan, with clear headings or bold keywords where appropriate.

8. The final summary should be concise, clear, and accessible to someone without specialized knowledge.
    `;

export const generateDocumentSummaryPromptV2 = (sourceText: string) => {
  return `
# Summary Instructions.

IMPORTANT: FIRST ANALYZE THE SOURCE TEXT AS ALL SUMMARY INFORMATION MUST BE DRAWN FROM THIS.

1. Begin with a concise 1–2 sentence overview that captures the main idea and importance of the document.

2. Use simple, everyday language. If any technical or medical terms must be included, briefly explain them in parentheses.

3. Focus only on the most important points, removing repetition or less relevant details.

4. Simplify complex ideas while preserving the original meaning.

5. Highlight any key statistics or figures, but only the most impactful ones.

6. Organize the summary logically, using bullet points or short sections if helpful.

7. Make the summary easy to scan, with clear headings or bold keywords where appropriate.

8. The final summary should be concise, clear, and accessible to someone without specialized knowledge.

**SOURCE TEXT START**
${sourceText}
**SOURCE TEXT END**
 
  `;
};

export const generateDocumentMessagePromptV2 = (
  question: string,
  sourceText: string,
) => {
  return `
  # Response Instructions

  IMPORTANT: Your primary job is to help the student understand clearly and thoroughly.

  1. First, carefully analyze the SOURCE TEXT provided below. It is your main source of truth when answering the student’s question.
  2. If the answer cannot be found in the SOURCE TEXT, you may refer to previous messages—especially if the question is a follow-up.
  3. Always answer the student’s question directly first.
  4. Explain everything in very simple, clear language. Break down any complex ideas or terminology into basic concepts.
     - Use real-world examples or analogies where helpful.
     - Assume the student is hearing this concept for the first time.
  5. Make your tone friendly, encouraging, and as human as possible. Speak as if you are guiding someone one-on-one.
  6. End your response with a helpful follow-up:
     - Ask a question to guide them to the next step.
     - Invite them to ask another question or clarify anything they’re unsure about.
     - Or suggest something related they might want to explore next.

  DO NOT mention the instructions above in your response. ONLY return the direct response to the student.

  HERE IS THE STUDENT'S QUESTION
  ** QUESTION START **
  ${question}
  ** QUESTION END **

  BELOW IS THE SOURCE TEXT THAT POSSIBLY CONTAINS ACCURATE INFORMATION FOR THE STUDENT'S RESPONSE

  ** SOURCE TEXT START **
  ${sourceText}
  ** SOURCE TEXT END **
  `;
};


export const generateEssayAnalysisPrompt = ({
  answer,
  question,
  sourceText,
}: {
  question: string;
  sourceText: string;
  answer: string;
}): string => {
  return `
   # Essay Examination Analysis Task

   ## Instructions:

   1. First, thoroughly review the reference document attached to this conversation thread. This document contains the authoritative information against which you must evaluate all student answers.

   2. Come up with your own through answer to the question based on the source text. This should be very indepth.

   3. Compare your response with that of the student to analyze what the student answered for accuracy and depth.

   4. Come up with your evaluation based on your answer and in relation to what the student answered.

   5. Apply strict scoring criteria (0-10) based on accuracy, completeness, and precision in relation to the reference text.

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


  **SOURCE TEXT START**

  ${sourceText}

  **SOURCE TEXT END**

  ** QUESTION START **
  ${question}
  ** QUESTION END **

  ** STUDENT'S RESPONSE START **
  ${answer}
  ** STUDENT RESPONSE END **

  `;
};
