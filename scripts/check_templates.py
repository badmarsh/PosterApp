with open('lib/latex/templates.ts', 'r', encoding='utf-8') as f:
    text = f.read()

print("Length:", len(text))
print("Has getMinimalTemplate:", 'export function getMinimalTemplate(' in text)
print("Has getGeminiTemplate:", 'export function getGeminiTemplate(' in text)
print("Has getAtlasTemplate:", 'export function getAtlasTemplate(' in text)
print("Has getTikzposterTemplate:", 'export function getTikzposterTemplate(' in text)
print("Has getA0PosterTemplate:", 'export function getA0PosterTemplate(' in text)
print("Has getLandscapeTemplate:", 'export function getLandscapeTemplate(' in text)
print("Has getBetterPosterTemplate:", 'export function getBetterPosterTemplate(' in text)
