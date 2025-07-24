# Contract Clause Inserter

This app allows you to upload a Word contract (.docx), enter a clause and an instruction, and automatically insert the clause at the correct place in the contract, preserving all formatting and styles.

## How it works

- **.docx manipulation:** Uses [PizZip](https://github.com/open-xml-templating/pizzip) to unzip and re-zip Word files, and manipulates the document XML directly to insert new content without breaking the file.
- **AI-powered insertion:** Uses OpenAI (or any compatible LLM) to analyze the contract's paragraphs and your instruction, and determine the correct insertion point for the clause.
- **Formatting preserved:** The clause is inserted as a new paragraph, copying the style of the surrounding text, so the output file remains valid and styled like the original.

## How to use

1. Start the dev server:
   ```sh
   npm run dev
   ```
2. Open the app in your browser.
3. Upload a `.docx` contract file.
4. Enter your instruction (e.g., "Insert this clause after the Definitions section.").
5. Enter the clause text.
6. Click "Insert Clause". The updated contract will be downloaded automatically.

## Technical notes

- **Paragraph extraction:** The backend extracts all paragraphs from the contract and sends them (with index numbers) to the AI for context.
- **OpenAI prompt:** The prompt is designed to be explicit, asking the AI to return only the index after which to insert the clause. If the AI is unsure, it returns -1 and the user is prompted to clarify.
- **No raw XML editing:** All XML manipulation is done in a way that preserves the document structure, avoiding file corruption.
- **No OpenAI credits?** You can hardcode the insertion index for local testing, or use a local LLM (see Ollama or Hugging Face for options).

## Requirements

- Node.js
- npm
- An OpenAI API key (or a compatible LLM endpoint)

## Customization

- You can swap out the OpenAI call for any LLM that can follow the same prompt/response pattern.
- For more advanced formatting, you can further parse and match styles in the XML.

---

For any issues or questions, see the code comments or open an issue!
