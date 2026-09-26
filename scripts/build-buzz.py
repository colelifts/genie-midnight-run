"""Build Buzz's racer and space kart. Run with Blender from the repository root."""
import math
import runpy
from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parents[1]
MODELS = ROOT / 'public' / 'models'
helpers = runpy.run_path(str(ROOT / 'scripts' / 'build-maleficent.py'), run_name='buzz_helpers')
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
    'Vermilion enamel': ('#e5ece9', 0.18, 0.3),
    'Anodized champagne': ('#80cb4b', 0.42, 0.28),
    'Brushed alloy': ('#6b507d', 0.46, 0.27),
    'Warm ivory racing stripe': ('#a6f266', 0.11, 0.3),
    'Rear lens': ('#4bd6ed', 0.08, 0.27),
    'Headlight ceramic': ('#d7faff', 0.08, 0.25),
    'Stitched charcoal seat': ('#76658d', 0.01, 0.74),
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

white = mat('Buzz porcelain armor', '#f2f4ec', 0.17, 0.34)
lime = mat('Buzz star command green', '#83d94e', 0.2, 0.32)
purple = mat('Buzz space ranger purple', '#715195', 0.14, 0.36)
deep = mat('Buzz indigo joints', '#37344e', 0.09, 0.56)
skin = mat('Buzz warm face', '#deb39a', 0.02, 0.58)
eye = mat('Buzz dark eyes', '#211d33', 0.01, 0.34)
cream = mat('Buzz eye white', '#fff8e9', 0.03, 0.42)
cyan = mat('Buzz flight cyan', '#8debf6', 0.1, 0.25, '#35badd', 0.35)
gold = mat('Buzz flight gold', '#edc672', 0.37, 0.29)
red = mat('Buzz command red', '#e84d5c', 0.15, 0.34)
dark = mat('Buzz dark detailing', '#283a48', 0.3, 0.31)

racer = empty('Buzz')
sphere('white spacesuit torso', (0, 0.01, 1.88), (0.49, 0.35, 0.65), white, racer)
sphere('lime chest armor', (0, -0.28, 1.89), (0.48, 0.12, 0.39), lime, racer)
sphere('white lower torso', (0, -0.02, 1.43), (0.4, 0.33, 0.24), white, racer)
sphere('purple waist seal', (0, 0.02, 1.37), (0.45, 0.34, 0.1), purple, racer)
for side in (-1, 1):
    sphere('shoulder armor', (side * 0.5, 0.02, 2.12), (0.25, 0.32, 0.26), white, racer)
    sphere('shoulder command band', (side * 0.54, -0.1, 2.12), (0.26, 0.1, 0.17), lime, racer)
    tapered('spacesuit arm', [(side * 0.52, -0.03, 2.06), (side * 0.61, -0.42, 1.86), (side * 0.45, -0.86, 1.69)],
            [0.2, 0.17, 0.1], white, racer)
    sphere('purple cuff', (side * 0.46, -0.7, 1.73), (0.16, 0.12, 0.12), purple, racer)
    sphere('gloved hand', (side * 0.46, -0.87, 1.68), (0.13, 0.11, 0.12), white, racer)
    sphere('arm shield', (side * 0.69, -0.27, 1.92), (0.1, 0.25, 0.14), lime, racer)
    sphere('white hip armor', (side * 0.32, 0.03, 1.1), (0.26, 0.27, 0.27), white, racer)
    sphere('purple boot toe', (side * 0.33, -0.3, 0.82), (0.22, 0.3, 0.18), purple, racer)

# The exposed face and raised dome rim stay legible in both the portrait and chase view.
sphere('purple helmet cowl', (0, 0.12, 2.91), (0.58, 0.53, 0.49), purple, racer)
sphere('Buzz face', (0, -0.18, 2.71), (0.42, 0.37, 0.48), skin, racer)
sphere('helmet crown', (0, 0.1, 3.15), (0.54, 0.48, 0.19), purple, racer)
tube('visor rim', [(-0.52, -0.45, 2.55), (-0.57, -0.42, 2.82), (-0.39, -0.4, 3.05),
                   (0, -0.41, 3.13), (0.39, -0.4, 3.05), (0.57, -0.42, 2.82),
                   (0.52, -0.45, 2.55)], 0.055, cyan, racer)
tube('helmet lower rim', [(-0.52, -0.42, 2.54), (0, -0.47, 2.42), (0.52, -0.42, 2.54)], 0.065, white, racer)
for side in (-1, 1):
    sphere('visor hinge', (side * 0.53, -0.3, 2.57), (0.11, 0.1, 0.11), gold, racer)
    sphere('eye white', (side * 0.18, -0.52, 2.72), (0.12, 0.045, 0.085), cream, racer)
    sphere('eye pupil', (side * 0.18, -0.56, 2.72), (0.055, 0.02, 0.06), eye, racer)
    sphere('eyebrow', (side * 0.18, -0.51, 2.86), (0.14, 0.025, 0.045), dark, racer)
sphere('Buzz nose', (0, -0.53, 2.61), (0.09, 0.065, 0.11), skin, racer)
sphere('Buzz chin', (0, -0.43, 2.4), (0.22, 0.12, 0.09), skin, racer)
tube('Buzz grin', [(-0.15, -0.515, 2.48), (0, -0.535, 2.455), (0.15, -0.515, 2.48)], 0.026, dark, racer)

cube('Star Command badge', (0, -0.405, 2.02), (0.26, 0.04, 0.18), white, racer, 0.04)
sphere('gold star on badge', (0, -0.44, 2.03), (0.08, 0.02, 0.08), gold, racer)
for n, material in enumerate((red, cyan, gold)):
    sphere('command button', (-0.19 + n * 0.19, -0.415, 1.78), (0.065, 0.025, 0.06), material, racer)

# Aerodynamic nose, engine pods, and tail fins keep the kart readable as a racer.
for side in (-1, 1):
    tapered('side jet pod', [(side * 1.15, -1.53, 0.78), (side * 1.2, 0.62, 0.83),
                             (side * 1.21, 1.68, 0.76)], [0.18, 0.23, 0.05], white)
    sphere('aft thrust nozzle', (side * 1.14, -1.75, 0.8), (0.22, 0.14, 0.21), purple)
    sphere('cyan thruster core', (side * 1.14, -1.88, 0.8), (0.12, 0.05, 0.12), cyan)
    sheet('folded command fin', [(side * 0.62, -1.28, 1.14), (side * 1.55, -1.38, 1.39),
                                  (side * 1.62, -0.8, 1.43), (side * 0.89, -0.67, 1.18)],
          [(0, 1, 2, 3)], lime, thickness=0.055)
    tube('flight fin stripe', [(side * 0.62, -1.29, 1.16), (side * 1.56, -1.4, 1.41),
                                (side * 1.64, -0.81, 1.45)], 0.045, purple)
    sphere('forward scan lamp', (side * 0.74, 1.66, 1.04), (0.16, 0.1, 0.13), cyan)
cone('rocket nose', (0, 1.89, 1.19), 0.23, 0.52, lime)
cube('command dash display', (0, -0.92, 1.28), (0.53, 0.09, 0.28), purple, bevel=0.045)
for n in range(5):
    sphere('dash status light', (-0.18 + n * 0.09, -0.98, 1.35), (0.027, 0.026, 0.027), cyan if n % 2 else lime)

racer.rotation_euler[2] = math.pi
racer.location.y = -0.58
export('buzz-kart.glb')
