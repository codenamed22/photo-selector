# Photo Selector

A Next.js application that uses multimodal LLMs to intelligently analyze and select the best photos from a collection. The app uses CLIP embeddings to group similar photos, then uses vision-capable LLMs to evaluate and select the best photo from each group.

## Features

- 📁 Folder scanning with support for various image formats (JPEG, PNG, HEIC, etc.)
- 🤖 AI-powered photo quality analysis using GPT-4o or Gemini
- 🎯 CLIP-based photo grouping by visual similarity
- 🖼️ Interactive photo viewer with similarity scores
- 💡 AI reasoning for photo selection decisions

<img width="2524" height="1369" alt="image" src="https://github.com/user-attachments/assets/a73039f1-0244-464b-a784-b131e046970c" />

<img width="2729" height="873" alt="image" src="https://github.com/user-attachments/assets/11fbd9b3-1a84-4e9b-9c91-67f26b62f678" />

<img width="1470" height="907" alt="image" src="https://github.com/user-attachments/assets/392efb57-c1e4-4846-b0a2-09cdc5b93c51" />


## Prerequisites

- Node.js 20+ 
- npm or yarn
- **LLM API access** (choose one):
  - OpenAI API key (recommended for public use)
  - Uber GenAI Gateway access (Uber internal only)
  - Azure OpenAI
  - Google AI API key
  - Any OpenAI-compatible API

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy the example file and configure for your LLM provider:

```bash
cp .env.local.example .env.local
```

**Quick Setup (OpenAI - Recommended):**
```bash
# Edit .env.local
LLM_PROVIDER=openai
OPENAI_API_KEY=your_openai_api_key_here
```

**For Other Providers:** See [LLM_CONFIGURATION.md](./LLM_CONFIGURATION.md) for detailed setup instructions for:
- Uber GenAI Gateway (internal)
- Azure OpenAI
- Google AI
- Custom providers

### 3. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

## Usage

1. **Enter a folder path** containing your photos (e.g., `/Users/you/Pictures/vacation`)
2. **Click "Scan"** to detect all images
3. **Click "Group Similar Photos"** - Uses CLIP to group visually similar photos
4. **View results** in a new tab showing:
   - Photo groups with similarity scores
   - Statistics (total photos, groups found, ungrouped)
5. **Click "Find Best Photo"** for each group - AI analyzes and selects the best photo
6. **Review AI reasoning** for why each photo was selected

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **UI**: React 19, Tailwind CSS 4
- **AI Models**: 
  - CLIP (ViT-B/32) via Transformers.js for embeddings
  - Multimodal LLM for photo analysis (supports OpenAI, Google, Azure, Uber internal, and custom providers)
- **Image Processing**: Sharp, heic-convert
- **Language**: TypeScript

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── generate-embeddings/  # CLIP embeddings
│   │   ├── group-photos/         # DBSCAN clustering
│   │   ├── select-best-photo/    # LLM photo analysis
│   │   ├── scan-folder/          # Folder scanning
│   │   ├── image/                # Image serving
│   │   └── direct-image/         # Direct image streaming
│   ├── results/                  # Results page
│   ├── page.tsx                  # Main page
│   └── layout.tsx                # Root layout
├── components/
│   ├── FolderSelector.tsx
│   └── PhotoViewer.tsx
└── utils/
    └── clustering.ts             # DBSCAN clustering
```

## API Routes

- `POST /api/scan-folder` - Scans a folder for image files
- `POST /api/generate-embeddings` - Generates CLIP embeddings for photos
- `POST /api/group-photos` - Groups photos using DBSCAN on embeddings
- `POST /api/select-best-photo` - Uses LLM to analyze and select best photo
- `GET /api/image` - Serves image files
- `GET /api/direct-image` - Direct image serving

## How It Works

### 1. Photo Grouping (CLIP + DBSCAN)
- Generates 512-dimensional CLIP embeddings for each photo
- Uses DBSCAN clustering with cosine distance
- Groups photos with similarity > 75% (distance < 0.25)

### 2. Best Photo Selection (Multimodal LLM)
- Sends grouped photos to GPT-4o or Gemini
- AI evaluates each photo for:
  - Sharpness/Focus (0-100)
  - Brightness/Exposure (0-100)
  - Composition (0-100)
  - Face Quality (0-100) - eyes open, face clarity
- Returns best photo with detailed reasoning

## Learn More

### Documentation
- [Next.js Documentation](https://nextjs.org/docs)
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [Google AI Documentation](https://ai.google.dev/docs)

### Technologies
- [CLIP](https://github.com/openai/CLIP) - Image embeddings
- [Transformers.js](https://huggingface.co/docs/transformers.js) - In-browser ML
- [DBSCAN](https://en.wikipedia.org/wiki/DBSCAN) - Density-based clustering
