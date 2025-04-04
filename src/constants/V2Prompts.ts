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
