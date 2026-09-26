"""Author Hades and his underworld kart as a compressed game-ready GLB.

Run from the repository root with Blender 5.2:
blender --background --python scripts/build-hades.py
"""

import math
import runpy
from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parents[1]
MODELS = ROOT / 'public' / 'models'
helpers = runpy.run_path(str(ROOT / 'scripts' / 'build-maleficent.py'), run_name='hades_helpers')
rgba, mat, empty = (helpers[name] for name in ('rgba', 'mat', 'empty'))
sphere, cube, cone, tube, tapered, sheet, export = (helpers[name] for name in ('sphere', 'cube', 'cone', 'tube', 'tapered', 'sheet', 'export'))

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(MODELS / 'mickey-kart.glb'))
old_driver = bpy.data.objects.get('Driver')
assert old_driver, 'The shared kart no longer has a Driver root'


def remove_tree(obj):
    for child in list(obj.children):
        remove_tree(child)
    bpy.data.objects.remove(obj, do_unlink=True)


remove_tree(old_driver)
recolors = {
    'Vermilion enamel': ('#283854', 0.34, 0.3),
    'Anodized champagne': ('#a585c1', 0.44, 0.28),
    'Brushed alloy': ('#5879ab', 0.51, 0.3),
    'Warm ivory racing stripe': ('#61d6f4', 0.13, 0.27),
    'Rear lens': ('#52aeff', 0.08, 0.22),
    'Headlight ceramic': ('#dcfaff', 0.1, 0.25),
    'Stitched charcoal seat': ('#292437', 0.02, 0.81),
}
for name, (color, metallic, roughness) in recolors.items():
    material = bpy.data.materials.get(name)
    if material:
        material.diffuse_color = rgba(color)
        bsdf = material.node_tree.nodes.get('Principled BSDF') if material.use_nodes else None
        if bsdf:
            bsdf.inputs['Base Color'].default_value = rgba(color)
            bsdf.inputs['Metallic'].default_value = metallic
            bsdf.inputs['Roughness'].default_value = roughness

basalt = mat('Hades basalt enamel', '#202639', 0.32, 0.37)
robe = mat('Hades charcoal robe', '#303044', 0.03, 0.75)
violet = mat('Hades violet folds', '#635177', 0.08, 0.57)
blue_skin = mat('Hades pale blue skin', '#859bd0', 0.02, 0.58)
deep_skin = mat('Hades cheek shadow', '#5d73ac', 0.02, 0.62)
eye_white = mat('Hades eye white', '#e5eaf5', 0.02, 0.4)
iris = mat('Hades sharp black iris', '#1a1b37', 0.03, 0.31)
mouth = mat('Hades crooked smile', '#28233f', 0.02, 0.62)
gold = mat('Underworld pale gold', '#ceb88b', 0.55, 0.3)
bone = mat('Underworld carved ivory', '#d9d4c2', 0.12, 0.49)
flame_dark = mat('Soul flame indigo', '#273c9a', 0.04, 0.36, '#173fb8', 0.48)
flame_mid = mat('Soul flame electric blue', '#3176df', 0.03, 0.25, '#125bc7', 0.72)
flame_tip = mat('Soul flame cyan', '#39bbf6', 0.02, 0.22, '#167fdc', 0.78)

racer = empty('Hades')
# A long, narrow silhouette distinguishes him from the broad racers. The
# billowing folds still give the chase camera a clear read of his character.
sphere('slender robed chest', (0, 0.06, 1.91), (0.46, 0.3, 0.65), robe, racer)
sphere('layered violet collar', (0, -0.19, 2.22), (0.43, 0.24, 0.22), violet, racer)
sphere('dark high shoulders', (0, 0.11, 2.21), (0.65, 0.39, 0.17), robe, racer)
sphere('waist drape', (0, 0.05, 1.43), (0.47, 0.32, 0.36), robe, racer)
for side in (-1, 1):
    sheet('flowing robe panel', [(side * 0.08, 0.3, 1.7), (side * 0.45, 0.34, 1.66),
                                 (side * 0.76, 0.78, 0.89), (side * 0.2, 0.56, 0.85)],
          [(0, 1, 2, 3)], robe, racer, thickness=0.035)
    tube('violet robe seam', [(side * 0.39, 0.37, 1.68), (side * 0.55, 0.58, 1.2),
                              (side * 0.73, 0.78, 0.9)], 0.028, violet, racer)
    sphere('bony shoulder', (side * 0.52, 0.01, 2.14), (0.25, 0.27, 0.24), robe, racer)
    tapered('thin blue arm', [(side * 0.53, 0.0, 2.08), (side * 0.65, -0.38, 1.91),
                              (side * 0.45, -0.89, 1.7)], [0.19, 0.14, 0.095], blue_skin, racer)
    sphere('long hand on wheel', (side * 0.45, -0.88, 1.68), (0.13, 0.13, 0.16), blue_skin, racer)
    tube('gold collar pin', [(side * 0.21, -0.37, 2.31), (side * 0.35, -0.35, 2.18)], 0.035, gold, racer)

sphere('angular Hades head', (0, -0.17, 2.77), (0.48, 0.39, 0.59), blue_skin, racer)
sphere('long pointed chin', (0, -0.41, 2.43), (0.29, 0.21, 0.18), blue_skin, racer)
for side in (-1, 1):
    sphere('cheek hollow', (side * 0.31, -0.47, 2.61), (0.16, 0.07, 0.13), deep_skin, racer)
    sphere('eye white', (side * 0.19, -0.52, 2.85), (0.17, 0.055, 0.1), eye_white, racer)
    sphere('dark pupil', (side * 0.2, -0.57, 2.84), (0.07, 0.025, 0.07), iris, racer)
    tube('arched sardonic brow', [(side * 0.06, -0.48, 3.0), (side * 0.2, -0.5, 3.05),
                                   (side * 0.37, -0.41, 2.99)], 0.045, iris, racer)
    sphere('pointed ear', (side * 0.49, -0.14, 2.78), (0.2, 0.18, 0.11), blue_skin, racer)
sphere('long narrow nose', (0, -0.56, 2.68), (0.095, 0.12, 0.18), blue_skin, racer)
tube('crooked grin', [(-0.26, -0.49, 2.48), (-0.06, -0.55, 2.46),
                      (0.19, -0.51, 2.49), (0.3, -0.46, 2.54)], 0.025, mouth, racer)

# The two-tone flame crown is authored as separate named parts so it can sway
# independently at runtime instead of looking like rigid blue hair.
for index in range(13):
    angle = math.tau * index / 13
    x = math.sin(angle) * (0.27 + index % 3 * 0.06)
    y = math.cos(angle) * 0.29 + 0.03
    height = 0.7 + (index % 4) * 0.18
    flame = tapered('HadesFlame_%02d' % index,
                    [(x, y, 3.12), (x * 1.12, y + 0.09, 3.42),
                     (x * 1.36 + 0.12, y + 0.2, 3.12 + height)],
                    [0.2, 0.2, 0.005], flame_dark if index % 4 == 0 else flame_mid, racer, sides=9)
    flame['flame_phase'] = index * 0.81
    tapered('inner flame %02d' % index,
            [(x * 0.86, y - 0.08, 3.22), (x * 1.02, y - 0.03, 3.48),
             (x * 1.2 + 0.12, y + 0.06, 3.24 + height * 0.82)],
            [0.095, 0.1, 0.004], flame_tip, racer, sides=8)
sphere('cyan flame root', (0, 0.0, 3.17), (0.42, 0.34, 0.2), flame_mid, racer)

# Basalt chariot features: long blue-lit rails, skull nose, and soul braziers.
for side in (-1, 1):
    tapered('chariot side rail', [(side * 1.18, -1.52, 0.88),
                                  (side * 1.32, 0.14, 0.91),
                                  (side * 1.15, 1.83, 0.87)],
            [0.17, 0.21, 0.06], basalt)
    tube('cyan edge inlay', [(side * 1.21, -1.54, 1.01),
                             (side * 1.33, 0.13, 1.04),
                             (side * 1.16, 1.8, 1.0)], 0.047, flame_mid)
    sphere('underworld lamp bowl', (side * 1.12, -1.3, 1.19), (0.3, 0.31, 0.15), bone)
    cone('underworld lamp fire', (side * 1.12, -1.3, 1.7), 0.26, 0.78, flame_mid)
    cone('lamp inner fire', (side * 1.12, -1.32, 1.62), 0.12, 0.55, flame_tip)
    sheet('bone rear fin', [(side * 0.63, -1.38, 1.19), (side * 1.78, -1.43, 1.48),
                            (side * 1.62, -0.78, 1.55), (side * 0.85, -0.63, 1.18)],
          [(0, 1, 2, 3)], bone, thickness=0.055)
    tube('fin indigo rune', [(side * 0.7, -1.35, 1.23), (side * 1.63, -1.36, 1.48),
                             (side * 1.57, -0.84, 1.54)], 0.048, flame_mid)

sphere('skull hood', (0, 1.74, 1.08), (0.36, 0.42, 0.28), bone)
for side in (-1, 1):
    sphere('skull eye socket', (side * 0.15, 2.08, 1.11), (0.085, 0.05, 0.08), flame_dark)
    sphere('skull eye flame', (side * 0.15, 2.12, 1.12), (0.04, 0.03, 0.04), flame_tip)
cone('skull tooth', (0, 2.19, 0.89), 0.11, 0.25, bone)
cube('obsidian dashboard', (0, -0.9, 1.22), (0.52, 0.09, 0.24), basalt, bevel=0.045)
for i in range(5):
    sphere('dash soul bead', ((i - 2) * 0.1, -0.98, 1.3), (0.03, 0.03, 0.03), flame_tip)

racer.rotation_euler[2] = math.pi
racer.location.y = -0.58
export('hades-kart.glb')
