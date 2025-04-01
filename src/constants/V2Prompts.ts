

export const generateSourceInfoPromptV2 = (question: string, sourceText: string, language = 'English') => {
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
    `
}