import PizZip from "pizzip";
import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const contract = formData.get("contract") as File | null;
  const clause = formData.get("clause") as File | null;
  const instruction = formData.get("instruction") as File | null;

  if (!contract || !clause || !instruction) {
    return new NextResponse("Missing files", { status: 400 });
  }

  async function fileToBuffer(file: File): Promise<Buffer> {
    const arrayBuffer = await file.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  const contractBuffer = await fileToBuffer(contract);
  const clauseText = (await fileToBuffer(clause)).toString("utf-8");
  const instructionText = (await fileToBuffer(instruction)).toString("utf-8");

  // Load the docx file with pizzip
  let zip;
  try {
    zip = new PizZip(contractBuffer);
  } catch (e) {
    return new NextResponse("Could not read docx file", { status: 400 });
  }

  // Parse the document XML to extract paragraphs
  const xml = zip.file("word/document.xml")?.asText() || "";
  const paragraphRegex = /<w:p[\s\S]*?<\/w:p>/g;
  const paragraphs = xml.match(paragraphRegex) || [];
  const paragraphTexts = paragraphs
    .map((p: string) => {
      const textMatches = [...p.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)];
      return textMatches
        .map((m: RegExpMatchArray) => m[1])
        .join("")
        .trim();
    })
    .filter(Boolean); // Remove empty paragraphs

  // Prepare context for OpenAI
  const context = paragraphTexts
    .map((t: string, i: number) => `Paragraph ${i}: "${t.slice(0, 200)}"`)
    .join("\n");
  const prompt = `
You are a legal document assistant.
Here are the paragraphs of the contract, each with its index:
${context}

Instruction: ${instructionText}

Clause: ${clauseText}

Based on the instruction, reply ONLY with the index (number) after which the clause should be inserted. 
If you are unsure, reply with -1. Do not reply with the last index unless the instruction clearly says to insert at the end.
Reply with only the number, no explanation.
If the instruction says 'after Definitions', and Definitions is paragraph 3, reply 3.
If the instruction says 'at the start', reply 0.
If the instruction says 'at the end', reply ${paragraphTexts.length}.
`;

  // Call OpenAI to get insertion index
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  let insertIdx = paragraphTexts.length;
  let aiReply = "";
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant for editing legal contracts.",
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 10,
      temperature: 0,
    });
    aiReply = completion.choices[0].message?.content?.trim() || "";
    console.log("OpenAI prompt:\n", prompt);
    console.log("OpenAI reply:", aiReply);
    const idx = parseInt(aiReply);
    if (!isNaN(idx) && idx >= 0 && idx <= paragraphTexts.length) {
      insertIdx = idx;
    } else if (idx === -1) {
      return new NextResponse(
        "OpenAI could not determine a valid insertion point. Please clarify your instruction.",
        { status: 400 }
      );
    } else {
      console.warn("AI returned invalid index:", aiReply);
    }
  } catch (e) {
    // fallback: insert at end
    console.error("OpenAI error:", e);
  }

  // Rebuild the document XML with the clause inserted at the correct index
  let newParagraphs: string[] = [];
  let inserted = false;
  for (let i = 0; i < paragraphs.length; i++) {
    newParagraphs.push(paragraphs[i]);
    if (i === insertIdx && !inserted) {
      // Insert the clause as a new paragraph, copying the style of the previous paragraph
      // (or use a default style if at the start)
      const styleSource = (i > 0 ? paragraphs[i - 1] : paragraphs[0]) || "";
      // Copy the <w:pPr> (paragraph properties) if present
      const pPrMatch = styleSource.match(/<w:pPr[\s\S]*?<\/w:pPr>/);
      const pPr = pPrMatch ? pPrMatch[0] : "";
      const clauseXml = `<w:p>${pPr}<w:r><w:t>${clauseText
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")}</w:t></w:r></w:p>`;
      newParagraphs.push(clauseXml);
      inserted = true;
    }
  }
  // If inserting at the end
  if (!inserted) {
    const styleSource =
      paragraphs.length > 0 ? paragraphs[paragraphs.length - 1] : "";
    const pPrMatch = styleSource.match(/<w:pPr[\s\S]*?<\/w:pPr>/);
    const pPr = pPrMatch ? pPrMatch[0] : "";
    const clauseXml = `<w:p>${pPr}<w:r><w:t>${clauseText
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")}</w:t></w:r></w:p>`;
    newParagraphs.push(clauseXml);
  }

  // Replace the document.xml with the new XML
  const newXml = xml.replace(
    /(<w:body>)([\s\S]*?)(<\/w:body>)/,
    (_match, p1, _body, p2) => `${p1}${newParagraphs.join("")}${p2}`
  );
  zip.file("word/document.xml", newXml);

  // Generate the new docx file
  const outBuffer = zip.generate({ type: "nodebuffer" });

  return new NextResponse(outBuffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": "attachment; filename=updated_contract.docx",
    },
  });
}
