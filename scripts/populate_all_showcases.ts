import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { prisma } from '../lib/prisma';
import { ALL_SHOWCASE_PROJECTS } from '../lib/showcases-data';
import { getTemplateDef } from '../lib/output-types';

async function main() {
  console.log(`Seeding and updating all ${ALL_SHOWCASE_PROJECTS.length} showcase workspaces in PostgreSQL Prisma DB...`);
  const defaultUserId = 'user_3IGDYw03LkmHZaaCgKwWcBYxHQu';

  // Strict safeguard: Validate that EVERY card has the required 'card_' prefix
  for (const s of ALL_SHOWCASE_PROJECTS) {
    for (const out of s.outputs) {
      for (const c of out.cards) {
        if (!c.id.startsWith("card_")) {
          throw new Error(`FATAL: Card ID "${c.id}" in workspace "${s.id}", output "${out.id}" violates the strict 'card_' prefix rule! Aborting seed.`);
        }
      }
    }
  }
  console.log("All card prefixes verified: strict 'card_' compliance confirmed.");

  for (const s of ALL_SHOWCASE_PROJECTS) {
    console.log(`Updating ${s.id} (${s.name})...`);

    const ws = await prisma.workspace.upsert({
      where: { id: s.id },
      create: {
        id: s.id,
        name: s.name,
        authors: s.authors,
        venue: s.venue,
        userId: defaultUserId,
        logoUrl: s.logoUrl,
        secondaryLogoUrl: s.secondaryLogoUrl,
      },
      update: {
        name: s.name,
        authors: s.authors,
        venue: s.venue,
        logoUrl: s.logoUrl,
        secondaryLogoUrl: s.secondaryLogoUrl,
      },
    });

    // Delete existing cards and outputs to avoid orphaned duplicates
    const existingOutputs = await prisma.output.findMany({ where: { workspaceId: s.id } });
    for (const out of existingOutputs) {
      await prisma.card.deleteMany({ where: { outputId: out.id } });
    }
    await prisma.output.deleteMany({ where: { workspaceId: s.id } });

    // Create outputs and their cards
    for (const out of s.outputs) {
      const createdOut = await prisma.output.create({
        data: {
          id: out.id,
          workspaceId: s.id,
          outputType: out.outputType,
          templateId: out.templateId,
          title: out.title,
          themeColor: out.themeColor ?? getTemplateDef(out.templateId)?.colors[0]?.hex ?? null,
          isActive: out.id === s.activeOutputId,
          logoUrl: out.logoUrl,
          secondaryLogoUrl: out.secondaryLogoUrl,
        },
      });

      if (out.cards.length > 0) {
        await prisma.card.createMany({
          data: out.cards.map((c) => ({
            id: c.id,
            outputId: createdOut.id,
            title: c.title || '',
            column: c.column,
            order: c.order,
            pattern: c.pattern,
            content: c.content,
            figureLayout: c.figureLayout || 'auto',
            heightBudget: c.heightBudget ?? null,
            validation: c.validation || 'valid',
            table: c.table as any,
            figures: c.figures as any,
            sourceIds: c.sourceIds as any,
          })),
        });
      }
    }

    // Replace assets
    await prisma.asset.deleteMany({ where: { workspaceId: s.id } });
    if (s.assets && s.assets.length > 0) {
      await prisma.asset.createMany({
        data: s.assets.map(a => ({
          id: a.id,
          workspaceId: s.id,
          fileId: a.fileId || a.filename || 'asset.png',
          filename: a.filename || 'asset.png',
          url: a.url,
          kind: a.kind || 'figure',
          page: a.page || 1,
          confidence: a.confidence || 'high',
          caption: a.caption || '',
        })),
      });
    }

    console.log(`✔ ${s.id} seeded successfully with ${s.outputs.length} outputs and ${s.assets.length} assets.`);
  }

  console.log(`All ${ALL_SHOWCASE_PROJECTS.length} showcases successfully populated in database!`);
}

main().catch(err => {
  console.error('Error populating showcases:', err);
  process.exit(1);
});
