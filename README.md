# ai-paper-reviewer

A minimal prototype of an AI peer-review copilot. Upload a manuscript (PDF or
text), and the app uses the OpenAI API to produce a structured, reviewer-style
report covering writing quality, structure, methodology, logical consistency,
novelty, and citation usage.

This is an early prototype focused on core text review. Literature retrieval /
reference checking and vision-based figure annotation are planned for later.

## Setup

```bash
conda activate <your-env>
pip install -r requirements.txt
```

Add your OpenAI API key:

```bash
cp .env.example .env
# then edit .env and set OPENAI_API_KEY=sk-...
```

## Run

```bash
streamlit run app.py
```

Then open the URL Streamlit prints (usually http://localhost:8501), upload a
paper or paste text, pick a model, and click **Generate Review**.

## Project layout

- `app.py` - Streamlit UI (upload -> extract -> review -> display)
- `reviewer.py` - builds the review prompt and calls the OpenAI API
- `pdf_utils.py` - extracts text from PDF / `.txt` / `.md` files
- `requirements.txt` - Python dependencies

## Notes

- Long papers are truncated (~40k characters) to stay within token limits for
  this prototype; the UI notes when truncation happens.
- Default model is `gpt-4o-mini`; `gpt-4o` is also selectable in the UI.
