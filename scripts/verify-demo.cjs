const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()
p.workspace.findUnique({
  where: { id: 'demo-lattice-2025' },
  include: {
    outputs: { include: { cards: { select: { id: true, title: true, column: true, order: true } } } }
  }
}).then(r => {
  console.log('Workspace:', r.name, '| userId:', r.userId)
  r.outputs.forEach(o => {
    console.log(' Output:', o.outputType, '/', o.templateId, '| cards:', o.cards.length, '| active:', o.isActive)
    o.cards.forEach(c => console.log('   -', c.order, c.title, c.column != null ? '(col ' + c.column + ')' : ''))
  })
}).finally(() => p.$disconnect())
