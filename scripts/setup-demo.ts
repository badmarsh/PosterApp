import { createClerkClient } from '@clerk/backend';
import { PrismaClient } from '@prisma/client';

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
const prisma = new PrismaClient();

async function main() {
  const marekId = "user_3II9ErPQnCOoAIF5G5q6CRUViYH";
  const significaId = "user_3IGDYw03LkmHZaaCgKwWcBYxHQu";

  console.log('1. Deleting marek user from Clerk...');
  try {
    await clerk.users.deleteUser(marekId);
    console.log('Deleted marek from Clerk.');
  } catch (e: any) {
    console.error('Error deleting marek from clerk (maybe already deleted):', e?.message);
  }

  console.log('2. Deleting workspaces for marek...');
  await prisma.workspace.deleteMany({ where: { userId: marekId } });

  console.log('3. Resetting workspaces for significa...');
  await prisma.workspace.deleteMany({ where: { userId: significaId } });

  console.log('4. Creating Tutorial Workspace...');
  const workspaceId = 'workspace_tutorial_demo';
  const outputId = 'output_tutorial_demo_poster';
  
  await prisma.workspace.create({
    data: {
      id: workspaceId,
      name: 'Tutorial Workspace',
      authors: 'Jane Doe, John Smith',
      venue: 'PosterApp 2026',
      userId: significaId,
      outputs: {
        create: [
          {
            id: outputId,
            outputType: 'poster',
            templateId: 'atlas',
            title: 'Welcome to PosterApp',
            isActive: true,
            cards: {
              create: [
                {
                  id: 'card_intro',
                  title: 'Introduction',
                  column: 1,
                  order: 1,
                  pattern: 'bullets',
                  content: 'Welcome to **PosterApp**! This demo workspace showcases our features.\n\n- Upload PDFs for AI to ingest\n- Generate beautiful LaTeX outputs\n- Use AI to auto-fill your cards',
                  figureLayout: 'single',
                  validation: 'valid'
                },
                {
                  id: 'card_math',
                  title: 'Math & Equations',
                  column: 2,
                  order: 1,
                  pattern: 'bullets',
                  content: 'We support complex LaTeX math extracted natively via MinerU.\n\n$$ E = mc^2 $$',
                  figureLayout: 'single',
                  validation: 'valid'
                },
                {
                  id: 'card_collab',
                  title: 'Real-time Collaboration',
                  column: 3,
                  order: 1,
                  pattern: 'bullets',
                  content: 'Powered by Yjs, you can collaborate with your team in real-time!',
                  figureLayout: 'single',
                  validation: 'valid'
                }
              ]
            }
          },
          {
            id: 'output_tutorial_demo_slides',
            outputType: 'slides',
            templateId: 'beamer-metropolis',
            title: 'Welcome to PosterApp (Slides)',
            isActive: false,
            cards: {
              create: [
                {
                  id: 'card_slide_1',
                  title: 'Slide 1',
                  column: null,
                  order: 1,
                  pattern: 'bullets',
                  content: 'This is a slide generated from the same workspace.',
                  figureLayout: 'single',
                  validation: 'valid'
                }
              ]
            }
          }
        ]
      }
    }
  });

  console.log('Tutorial workspace created successfully.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
