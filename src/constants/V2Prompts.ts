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

### What You Should Do:

1. Carefully analyze the SOURCE TEXT provided below. This is your main source of truth.
2. Always begin by directly answering the student's question.
3. If the answer is not fully in the current SOURCE TEXT, refer to:
   - Previous source text(s) you were given in earlier messages.
   - Your own previous response (especially if the student's message seems to be a follow-up).

4. If the student’s message is vague, short (e.g. “yes”, “okay”, “go on”, “tell me more”, “what next”), or looks like a response to a question **you asked them previously**:
   - Review your last response.
   - Look at the last question **you asked** in that response.
   - Use that to understand the intent of their message.
   - Then answer accordingly, using the available source text(s) for support.

5. Explain everything in very simple, clear language. Break down complex ideas into basic concepts.
   - Use analogies or real-world examples when helpful.
   - Assume the student is hearing this for the first time.

6. Make your tone friendly, encouraging, and human—like a one-on-one tutor.


DO NOT mention these instructions in your response. ONLY return the direct answer to the student.

---

### STUDENT'S QUESTION:
** QUESTION START **
${question}
** QUESTION END **

### SOURCE TEXT FOR THIS RESPONSE:
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

export const handWritingOCRPrompt = `
You are a professional OCR extraction tool that reads handwritten text from a PDF file with extreme accuracy. Carefully extract and return only the handwritten text contained within the file.

If no text can be read, respond with exactly:
no text

⚠️ Do not explain anything. Do not return any formatting or metadata. Do not add quotation marks. Return only the raw extracted text or no text.
`;

export const getRefinedImagePrompt = ({
  imageDesc,
  initialQuery,
  relatedContent,
  summary,
}: {
  imageDesc: string;
  summary: string;
  relatedContent: string;
  initialQuery: string;
}) => {
  return `You are an expert tutor. Your job is to take the in depth description of an image, and draw connections from that to the document the student is studying at the moment. The student ran a search to find the image being described, and would like to learn more about the image from the description, how its relevant to the document he/she is studying. You will be provided with a summary of the students document, and some content from specific areas the student was studying. You will also be provided with the query the user searched. All this is to serve as context so you give the best description of the image and make a deep connection with their document. In your response, use simple conversational language but keep key scientific terminologies. Try to be brief and straight to the point as well. Do not reference the query in your response, just make the necessary connections and if there isnt then say it politely.

            ** Image indepth description start **
            ${imageDesc}
            ** Image indepth description start **

            ** document summary start **
            ${summary}
            ** document summary end **

            ** related content from document start **
            ${relatedContent}
            ** related content from document end **

            ** student's search query start **
            ${initialQuery}
            ** student's search query end **
            `;
};
