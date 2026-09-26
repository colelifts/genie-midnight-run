"""Author Moana and her ocean racer as a compressed game-ready GLB.

Run from the repository root with Blender 5.2:
blender --background --python scripts/build-moana.py
"""

import math
import runpy
from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parents[1]
MODELS = ROOT / 'public' / 'models'
helpers = runpy.run_path(str(ROOT / 'scripts' / 'build-maleficent.py'), run_name='moana_helpers')
rgba = helpers['rgba']
mat = helpers['mat']
empty = helpers['empty']
sphere = helpers['sphere']
cube = helpers['cube']
cone = helpers['cone']
tube = helpers['tube']
tapered = helpers['tapered']
sheet = helpers['sheet']
export = helpers['export']


bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(MODELS / 'mickey-kart.glb'))
driver = bpy.data.objects.get('Driver')
assert driver, 'The shared racing kart no longer has a Driver root'


def remove_tree(object):
    for child in list(object.children):
        remove_tree(child)
    bpy.data.objects.remove(object, do_unlink=True)


remove_tree(driver)

recolors = {
    'Vermilion enamel': ('#3e756c', 0.2, 0.37),
    'Anodized champagne': ('#d2ad70', 0.52, 0.32),
    'Brushed alloy': ('#6d5a45', 0.42, 0.37),
    'Warm ivory racing stripe': ('#7de6d2', 0.12, 0.28),
    'Rear lens': ('#2fc5c1', 0.12, 0.24),
    'Headlight ceramic': ('#d1fff5', 0.12, 0.24),
    'Stitched charcoal seat': ('#44352c', 0.02, 0.8),
}
for name, (color, metal, rough) in recolors.items():
    material = bpy.data.materials.get(name)
    if not material:
        continue
    material.diffuse_color = rgba(color)
    bsdf = material.node_tree.nodes.get('Principled BSDF') if material.use_nodes else None
    if bsdf:
        bsdf.inputs['Base Color'].default_value = rgba(color)
        bsdf.inputs['Metallic'].default_value = metal
        bsdf.inputs['Roughness'].default_value = rough

skin = mat('Moana warm skin', '#b87b52', 0.01, 0.59)
skin_light = mat('Moana sunlit skin', '#cd9065', 0.01, 0.53)
shadow = mat('Moana hair black brown', '#211b20', 0.03, 0.58)
hair_light = mat('Moana hair warm highlights', '#68432f', 0.08, 0.48)
coral = mat('Moana coral red top', '#c6493c', 0.04, 0.65)
pattern = mat('Moana geometric top embroidery', '#e5b490', 0.08, 0.5)
cream = mat('Moana woven cream wrap', '#ead8ae', 0.02, 0.84)
ochre = mat('Moana tapa cloth', '#bb845d', 0.03, 0.75)
rope = mat('Moana hemp rope', '#b99c6d', 0.03, 0.82)
teal = mat('Ocean luminous teal', '#4bd5cd', 0.11, 0.27, '#278989', 0.25)
seafoam = mat('Ocean seafoam', '#d6fff2', 0.03, 0.35, '#6adcd2', 0.35)
wood = mat('Polished outrigger wood', '#76543c', 0.05, 0.67)
dark_wood = mat('Carved outrigger inlay', '#3a382f', 0.04, 0.73)
pearl = mat('Mother of pearl', '#f4e7c6', 0.16, 0.27)
eye_white = mat('Moana eye white', '#f7ebd9', 0.02, 0.46)
iris = mat('Moana brown iris', '#4a2b21', 0.02, 0.39)
lips = mat('Moana warm lip', '#9b574d', 0.02, 0.56)
tattoo = mat('Moana blue tattoo', '#386f84', 0.02, 0.56)

racer = empty('Moana')
sphere('Moana torso', (0, 0.0, 1.87), (0.47, 0.31, 0.72), skin, racer)
sphere('coral wrap top', (0, -0.04, 2.02), (0.5, 0.34, 0.41), coral, racer)
sphere('red back sash', (0, 0.3, 2.07), (0.46, 0.075, 0.22), coral, racer)
sphere('cream band at top', (0, -0.13, 2.28), (0.49, 0.36, 0.12), cream, racer)
sphere('woven waist belt', (0, 0.02, 1.52), (0.48, 0.36, 0.15), rope, racer)
sphere('tapa cloth skirt', (0, 0.04, 1.14), (0.59, 0.43, 0.42), ochre, racer)
for side in (-1, 1):
    sheet('cream skirt front panel', [(side * 0.06, -0.42, 1.49), (side * 0.39, -0.28, 1.48),
                                      (side * 0.58, -0.32, 0.78), (side * 0.02, -0.5, 0.74)],
          [(0, 1, 2, 3)], cream, racer, 0.025)
    tube('top hem weave', [(side * 0.02, -0.43, 1.92), (side * 0.24, -0.38, 1.86),
                           (side * 0.42, -0.18, 1.86)], 0.032, pattern, racer)
    for line in range(3):
        tube('tattooed arm motif', [(side * (0.56 + line * 0.035), -0.1, 2.0 - line * 0.11),
                                   (side * (0.72 + line * 0.03), -0.19, 1.89 - line * 0.11)],
             0.017, tattoo, racer, 2)
    sphere('bare shoulder', (side * 0.48, 0.02, 2.13), (0.24, 0.28, 0.27), skin_light, racer)
    tapered('arm on helm', [(side * 0.51, -0.04, 2.09), (side * 0.64, -0.39, 1.92),
                           (side * 0.46, -0.83, 1.78)], [0.19, 0.16, 0.105], skin, racer)
    sphere('hand gripping helm', (side * 0.48, -0.83, 1.77), (0.15, 0.14, 0.12), skin_light, racer)
    tube('shell bracelet', [(side * 0.36, -0.7, 1.79), (side * 0.48, -0.74, 1.79),
                            (side * 0.6, -0.69, 1.8)], 0.035, pearl, racer)

# Large flowing hair reads from behind during gameplay and frames the face in the roster.
sphere('Moana face', (0, -0.15, 2.75), (0.43, 0.37, 0.57), skin_light, racer)
sphere('full dark hair cap', (0, 0.06, 2.96), (0.56, 0.49, 0.48), shadow, racer)
sphere('warm side bangs', (0.05, -0.37, 3.13), (0.42, 0.19, 0.19), hair_light, racer)
sphere('pearl flower in hair', (-0.39, 0.48, 3.1), (0.2, 0.08, 0.2), pearl, racer)
for petal in range(5):
    angle = math.tau * petal / 5
    sphere('flower petal', (-0.39 + math.sin(angle) * 0.2, 0.52, 3.1 + math.cos(angle) * 0.2),
           (0.12, 0.06, 0.16), cream, racer, 20)
sphere('flower turquoise heart', (-0.39, 0.59, 3.1), (0.08, 0.04, 0.08), teal, racer)
for side in (-1, 1):
    tapered('thick windblown hair', [(side * 0.39, 0.1, 3.15),
                                    (side * 0.55, 0.34, 2.83),
                                    (side * 0.67, 0.45, 2.3),
                                    (side * 0.72, 0.61, 1.93),
                                    (side * 0.83, 0.82, 1.61)],
            [0.3, 0.32, 0.29, 0.2, 0.012], shadow, racer)
    for lock in range(4):
        shift = lock * 0.11
        tapered('hair curl highlight', [(side * (0.46 + shift), 0.42, 2.74),
                                        (side * (0.54 + shift), 0.6, 2.27),
                                        (side * (0.68 + shift), 0.78, 1.92),
                                        (side * (0.7 + shift), 0.94, 1.64)],
                [0.052, 0.065, 0.045, 0.002], hair_light, racer, 8)
    sphere('dark expressive eyebrow', (side * 0.18, -0.49, 2.97), (0.15, 0.04, 0.065), shadow, racer)
    sphere('eye white', (side * 0.17, -0.51, 2.8), (0.12, 0.045, 0.08), eye_white, racer)
    sphere('brown eye', (side * 0.17, -0.55, 2.79), (0.056, 0.021, 0.064), iris, racer)
    sphere('eye glint', (side * 0.15, -0.574, 2.81), (0.021, 0.009, 0.025), eye_white, racer)
sphere('small nose', (0, -0.51, 2.64), (0.085, 0.075, 0.12), skin_light, racer)
sphere('smile', (0, -0.52, 2.49), (0.15, 0.03, 0.032), lips, racer)

# Heart of Te Fiti necklace, with its green center visible during selection.
for side in (-1, 1):
    tube('necklace cord', [(side * 0.24, -0.36, 2.46), (side * 0.16, -0.46, 2.29),
                           (0, -0.51, 2.2)], 0.022, rope, racer)
sphere('green heart pendant', (0, -0.54, 2.22), (0.14, 0.047, 0.16), teal, racer)
for n in range(5):
    angle = math.tau * n / 5
    sphere('shell pendant detail', (math.sin(angle) * 0.07, -0.59, 2.22 + math.cos(angle) * 0.07),
           (0.025, 0.012, 0.028), seafoam, racer, 16)

# The chassis becomes a double-outrigger ocean kart with carved rails and a
# transparent wave crest. Its four wheels remain readable for kart gameplay.
for side in (-1, 1):
    tapered('carved outrigger', [(side * 1.63, -1.78, 0.69),
                                (side * 1.82, -0.78, 0.55),
                                (side * 1.82, 0.84, 0.55),
                                (side * 1.61, 2.03, 0.78)],
            [0.08, 0.23, 0.23, 0.01], wood)
    for fore in (-1, 1):
        tube('outrigger cross brace', [(side * 1.07, fore * 0.9, 0.82),
                                      (side * 1.52, fore * 0.92, 0.77),
                                      (side * 1.8, fore * 0.92, 0.61)], 0.07, rope)
    tube('turquoise hull trim', [(side * 1.14, -1.7, 1.13),
                                 (side * 1.19, 0, 1.13),
                                 (side * 1.12, 1.68, 1.13)], 0.07, teal)
    for n in range(4):
        sphere('pearl shell trim', (side * 1.12, -1.2 + n * 0.78, 1.16),
               (0.09, 0.11, 0.06), pearl)

tube('front canoe prow', [(0, 1.52, 1.15), (0, 1.91, 1.23),
                           (0, 2.22, 1.59), (0, 2.28, 1.88)], 0.11, wood)
sphere('prow ocean jewel', (0, 2.24, 1.88), (0.13, 0.11, 0.13), teal)
for side in (-1, 1):
    sheet('crest of breaking water', [(side * 0.17, -1.76, 1.12),
                                      (side * 0.95, -1.87, 1.16),
                                      (side * 1.45, -1.92, 1.69),
                                      (side * 1.12, -1.8, 1.46),
                                      (side * 0.8, -1.68, 1.26)],
          [(0, 1, 4), (1, 2, 3, 4)], teal, thickness=0.045)
    tube('foam crest line', [(side * 0.94, -1.88, 1.15),
                             (side * 1.42, -1.93, 1.68),
                             (side * 1.11, -1.82, 1.47)], 0.045, seafoam)

# A paddle is strapped to the passenger side instead of floating in a hand.
oar = empty('Moana paddle', (1.27, 0.24, 0))
tapered('paddle shaft', [(0, -1.26, 1.26), (0, 0.98, 1.3)], [0.055, 0.065], dark_wood, oar)
sheet('paddle blade', [(-0.21, 0.97, 1.29), (0.21, 0.97, 1.29),
                       (0.31, 1.55, 1.32), (0, 1.87, 1.36), (-0.31, 1.55, 1.32)],
      [(0, 1, 2, 3, 4)], wood, oar, 0.075)

racer.rotation_euler[2] = math.pi
racer.location.y = -0.65
export('moana-kart.glb')
