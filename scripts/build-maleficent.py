"""Build the original Maleficent racer and dragon assets with Blender 5.2.

Run: blender --background --python scripts/build-maleficent.py
All geometry and materials below are authored for this game; the detailed kart
chassis is reworked from the game's own Mickey kart so both racers share polish.
"""

import bpy
import math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
MODELS = ROOT / 'public' / 'models'


def rgba(color):
    color = color.lstrip('#')
    parts = [int(color[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in parts) + (1,)


def mat(name, color, metallic=0, roughness=0.48, emission=None, emission_strength=0):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = rgba(color)
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = roughness
    if emission:
        bsdf.inputs['Emission Color'].default_value = rgba(emission)
        bsdf.inputs['Emission Strength'].default_value = emission_strength
    material.diffuse_color = rgba(color)
    return material


def parented(obj, parent):
    if parent:
        obj.parent = parent
    return obj


def empty(name, location=(0, 0, 0), parent=None):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    return parented(obj, parent)


def smooth(obj):
    if obj.type == 'MESH':
        for face in obj.data.polygons:
            face.use_smooth = True
    return obj


def sphere(name, location, scale, material, parent=None, segments=32):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=20, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.data.materials.append(material)
    return smooth(parented(obj, parent))


def cube(name, location, scale, material, parent=None, bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.data.materials.append(material)
    if bevel:
        modifier = obj.modifiers.new('soft edges', 'BEVEL')
        modifier.width = bevel
        modifier.segments = 3
        obj.modifiers.new('weighted normals', 'WEIGHTED_NORMAL')
    return parented(obj, parent)


def cone(name, location, radius, depth, material, parent=None, vertices=20):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius, radius2=0, depth=depth, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material)
    return smooth(parented(obj, parent))


def tube(name, points, radius, material, parent=None, resolution=4):
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.resolution_u = 18
    curve.bevel_depth = radius
    curve.bevel_resolution = resolution
    spline = curve.splines.new('BEZIER')
    spline.bezier_points.add(len(points) - 1)
    for point, coordinate in zip(spline.bezier_points, points):
        point.co = coordinate
        point.handle_left_type = 'AUTO'
        point.handle_right_type = 'AUTO'
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    return parented(obj, parent)


def tapered(name, points, radii, material, parent=None, sides=14):
    centers = [Vector(p) for p in points]
    verts = []
    faces = []
    for index, center in enumerate(centers):
        direction = (centers[min(index + 1, len(centers) - 1)] - centers[max(index - 1, 0)]).normalized()
        side = direction.cross(Vector((0, 1, 0))).normalized()
        if side.length < 0.1:
            side = direction.cross(Vector((1, 0, 0))).normalized()
        other = direction.cross(side).normalized()
        for segment in range(sides):
            angle = segment * math.tau / sides
            verts.append(center + radii[index] * (side * math.cos(angle) + other * math.sin(angle)))
        if index:
            previous = (index - 1) * sides
            current = index * sides
            for segment in range(sides):
                nxt = (segment + 1) % sides
                faces.append((previous + segment, previous + nxt, current + nxt, current + segment))
    faces.append(tuple(reversed(range(sides))))
    faces.append(tuple((len(centers) - 1) * sides + segment for segment in range(sides)))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    return smooth(parented(obj, parent))


def sheet(name, vertices, faces, material, parent=None, thickness=0.025):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    if thickness:
        modifier = obj.modifiers.new('cloth thickness', 'SOLIDIFY')
        modifier.thickness = thickness
    return parented(obj, parent)


def clear():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)


def export(name):
    path = MODELS / name
    bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', export_draco_mesh_compression_enable=True,
                              export_draco_mesh_compression_level=6, export_apply=True)
    print(f'EXPORTED {path.name}: {path.stat().st_size} bytes')


def build_racer():
    clear()
    bpy.ops.import_scene.gltf(filepath=str(MODELS / 'mickey-kart.glb'))
    driver = bpy.data.objects.get('Driver')
    assert driver, 'Mickey kart hierarchy changed'
    descendants = []
    def gather(obj):
        for child in obj.children:
            gather(child)
        descendants.append(obj)
    gather(driver)
    for obj in descendants:
        bpy.data.objects.remove(obj, do_unlink=True)

    recolors = {
        'Vermilion enamel': ('#281a42', 0.36, 0.25),
        'Anodized champagne': ('#b9a070', 0.67, 0.29),
        'Brushed alloy': ('#625875', 0.67, 0.3),
        'Warm ivory racing stripe': ('#65db77', 0.12, 0.37),
        'Rear lens': ('#8b39bd', 0.18, 0.22),
        'Headlight ceramic': ('#9bffa2', 0.11, 0.22),
        'Stitched charcoal seat': ('#22162e', 0.04, 0.7),
    }
    for name, (color, metal, rough) in recolors.items():
        material = bpy.data.materials.get(name)
        if material:
            material.diffuse_color = rgba(color)
            bsdf = material.node_tree.nodes.get('Principled BSDF') if material.use_nodes else None
            if bsdf:
                bsdf.inputs['Base Color'].default_value = rgba(color)
                bsdf.inputs['Metallic'].default_value = metal
                bsdf.inputs['Roughness'].default_value = rough

    ebony = mat('Maleficent obsidian velvet', '#151120', 0.07, 0.72)
    plum = mat('Deep violet lining', '#542266', 0.11, 0.55)
    back_purple = mat('Iridescent violet mantle', '#7c4599', 0.14, 0.42, '#3c1658', 0.22)
    violet = mat('Purple satin bodice', '#4b2b66', 0.15, 0.37)
    pale = mat('Pale ivory face', '#d9d1bb', 0.03, 0.57)
    lips = mat('Mulberry lips', '#903452', 0.09, 0.47)
    gold = mat('Aged gold trim', '#cfad70', 0.65, 0.33)
    green = mat('Enchanted emerald', '#7dff9b', 0.09, 0.22, '#3aff66', 1.8)
    dark_green = mat('Curse green', '#185c37', 0.21, 0.45, '#32af55', 0.65)
    iris = mat('Maleficent iris', '#a5f07b', 0.04, 0.26, '#80ee52', 0.4)

    # The imported kart's hood faces Blender +Y. The authored figure faces -Y,
    # so turn the whole figure toward the hood after constructing her details.
    racer = empty('Maleficent')
    sphere('narrow waist and shoulders', (0, 0.05, 1.86), (0.44, 0.32, 0.83), ebony, racer)
    # The racing camera sees her from behind; a raised mantle keeps her
    # silhouette readable above the dark seat and chassis.
    sphere('violet back mantle', (0, 0.4, 2.1), (0.46, 0.2, 0.79), back_purple, racer)
    sphere('hood violet back crest', (0, 0.34, 2.75), (0.37, 0.14, 0.53), back_purple, racer)
    for side in (-1, 1):
        tube('mantle gold seam', [(side * 0.32, 0.49, 2.59), (side * 0.4, 0.5, 2.1), (side * 0.22, 0.48, 1.53)], 0.024, gold, racer)
    sphere('purple corset', (0, -0.27, 1.82), (0.33, 0.13, 0.59), violet, racer)
    for side in (-1, 1):
        tube('gilded corset seam', [(side * 0.19, -0.38, 1.36), (side * 0.25, -0.39, 1.78), (side * 0.2, -0.3, 2.18)], 0.024, gold, racer)
    sphere('hood sculpt', (0, -0.07, 2.73), (0.52, 0.43, 0.67), ebony, racer)
    sphere('angular face', (0, -0.4, 2.7), (0.37, 0.18, 0.46), pale, racer)
    sphere('pointed chin', (0, -0.48, 2.46), (0.24, 0.13, 0.22), pale, racer)
    sphere('nose bridge', (0, -0.59, 2.72), (0.09, 0.12, 0.21), pale, racer)
    sphere('nose tip', (0, -0.7, 2.64), (0.105, 0.075, 0.075), pale, racer)
    sphere('lips', (0, -0.615, 2.51), (0.155, 0.025, 0.04), lips, racer)
    for side in (-1, 1):
        sphere('violet eye shadow', (side * 0.16, -0.55, 2.79), (0.175, 0.045, 0.096), plum, racer)
        sphere('almond eye', (side * 0.16, -0.59, 2.765), (0.135, 0.046, 0.058), pale, racer)
        sphere('emerald eye', (side * 0.155, -0.635, 2.762), (0.045, 0.015, 0.053), iris, racer)
        tube('arched brow', [(side * 0.035, -0.6, 2.91), (side * 0.17, -0.63, 2.955), (side * 0.32, -0.55, 2.89)], 0.029, ebony, racer)
        horn_points = [(side * 0.28, 0.01, 3.04), (side * 0.42, 0.01, 3.33), (side * 0.69, 0.04, 3.57),
                       (side * 0.67, 0.1, 3.89), (side * 0.41, 0.13, 4.17)]
        tapered('swept black horn', horn_points, [0.18, 0.155, 0.115, 0.06, 0.008], ebony, racer)
        # Collar makes the silhouette readable at racing-camera distance.
        sheet('high bat collar', [(side * 0.38, 0.16, 1.75), (side * 0.73, 0.06, 2.18),
                                  (side * 1.02, 0.06, 3.11), (side * 0.57, 0.13, 2.83),
                                  (side * 0.51, 0.26, 2.09)], [(0, 1, 4), (1, 2, 3, 4)], ebony, racer, 0.05)
        sheet('purple collar underside', [(side * 0.57, 0.055, 2.13), (side * 0.91, 0.055, 2.95),
                                           (side * 0.62, 0.055, 2.65)], [(0, 1, 2)], plum, racer)
        sphere('shoulder', (side * 0.45, 0.06, 2.21), (0.28, 0.32, 0.3), ebony, racer)
        tapered('slender sleeve', [(side * 0.51, 0.0, 2.18), (side * 0.66, -0.29, 1.95),
                                   (side * 0.5, -0.8, 1.8)], [0.24, 0.19, 0.11], ebony, racer)
        sphere('hand on steering wheel', (side * 0.48, -0.82, 1.8), (0.16, 0.13, 0.12), pale, racer)
        tube('gold sleeve edge', [(side * 0.37, -0.66, 1.82), (side * 0.51, -0.66, 1.84), (side * 0.62, -0.58, 1.87)], 0.034, gold, racer)

    # A layered cloak sweeps behind the seat and forks into pointed tails.
    for side in (-1, 1):
        sheet('swept outer cloak', [(side * 0.28, 0.2, 2.19), (side * 0.7, 0.47, 1.88),
                                    (side * 1.32, 1.08, 0.73), (side * 0.65, 1.45, 0.43),
                                    (0, 1.18, 0.68), (0, 0.22, 1.53)],
              [(0, 1, 5), (1, 2, 4, 5), (2, 3, 4)], ebony, racer, 0.07)
        sheet('cloak violet lining', [(side * 0.33, 0.22, 1.93), (side * 1.2, 1.1, 0.67),
                                      (side * 0.62, 1.42, 0.5), (0, 1.13, 0.77)],
              [(0, 1, 3), (1, 2, 3)], plum, racer, 0.018)
    sphere('emerald brooch', (0, -0.38, 2.21), (0.17, 0.09, 0.2), green, racer)
    sphere('brooch gold cradle', (0, -0.34, 2.2), (0.25, 0.05, 0.28), gold, racer)

    # Staff is strapped to the kart rather than floating beside her hand.
    staff = empty('Staff', (0.85, -0.59, 0))
    tapered('staff dark shaft', [(0, 0, 0.72), (0.02, 0.02, 1.8), (-0.1, 0, 3.08)], [0.075, 0.07, 0.09], ebony, staff)
    for side in (-1, 1):
        tapered('staff curved prong', [(-0.1, 0, 3.0), (side * 0.23, 0, 3.35), (side * 0.34, 0, 3.74)], [0.09, 0.075, 0.012], gold, staff)
    sphere('staff emerald orb', (-0.1, -0.01, 3.53), (0.29, 0.29, 0.29), green, staff)
    sphere('staff orb inner', (-0.1, -0.09, 3.54), (0.14, 0.11, 0.14), dark_green, staff)

    # Kart-specific thorn ornaments make the shared chassis feel distinct.
    for side in (-1, 1):
        tapered('front thorn', [(side * 0.95, -1.42, 1.07), (side * 1.24, -1.71, 1.43),
                                 (side * 1.18, -2.16, 1.8)], [0.18, 0.13, 0.012], ebony)
        tapered('rear curled thorn', [(side * 1.1, 1.0, 1.18), (side * 1.67, 1.42, 1.8),
                                      (side * 1.95, 1.05, 2.35), (side * 1.72, 0.81, 2.52)],
                [0.17, 0.12, 0.07, 0.01], ebony)
        sphere('side green jewel', (side * 1.16, -0.88, 1.22), (0.16, 0.075, 0.16), green)
    sphere('hood curse jewel', (0, 1.82, 1.27), (0.25, 0.13, 0.17), green)
    racer.rotation_euler[2] = math.pi
    export('maleficent-kart.glb')


def build_dragon():
    clear()
    ebony = mat('Dragon obsidian scales', '#15101e', 0.11, 0.59)
    purple = mat('Dragon plum armor', '#43204f', 0.13, 0.53)
    belly = mat('Dragon violet belly', '#665073', 0.18, 0.44)
    wing = mat('Dragon translucent wine wings', '#672756', 0.1, 0.6)
    gold = mat('Dragon antique horn gold', '#aa9466', 0.28, 0.49)
    eye = mat('Dragon poison eyes', '#a6ff86', 0.04, 0.24, '#69ff53', 1.8)
    flame = mat('Dragon green mouth fire', '#3bce69', 0.02, 0.32, '#3cff58', 1.5)
    root = empty('Dragon')

    sphere('powerful chest', (0, -0.18, 2.3), (1.0, 1.5, 0.88), ebony, root)
    sphere('violet plated chest', (0, -0.61, 2.04), (0.75, 1.13, 0.59), purple, root)
    for index in range(7):
        y = -1.42 + index * 0.4
        z = 1.83 + math.sin(index * 0.46) * 0.1
        sphere('overlapping belly scale', (0, y, z), (0.61 - index * 0.025, 0.31, 0.11), belly, root, 24)

    tapered('arched long neck', [(0, -0.9, 2.5), (0, -1.42, 2.93), (0, -1.9, 3.4),
                                  (0, -2.22, 3.91)], [0.58, 0.48, 0.36, 0.26], ebony, root, 18)
    sphere('angular skull', (0, -2.34, 3.85), (0.69, 0.67, 0.52), ebony, root)
    sphere('long muzzle', (0, -2.95, 3.55), (0.48, 0.93, 0.27), ebony, root)
    sphere('lower jaw shadow', (0, -3.05, 3.28), (0.44, 0.78, 0.15), purple, root)
    sphere('toxic glow in throat', (0, -3.22, 3.34), (0.25, 0.45, 0.09), flame, root)
    for side in (-1, 1):
        sphere('dragon eye socket', (side * 0.48, -2.56, 3.96), (0.24, 0.19, 0.16), purple, root)
        sphere('luminous eye', (side * 0.58, -2.64, 3.97), (0.12, 0.1, 0.07), eye, root)
        tapered('back swept head horn', [(side * 0.5, -2.03, 4.19), (side * 0.89, -1.7, 4.69),
                                         (side * 1.17, -1.18, 4.93), (side * 0.98, -0.84, 5.25)],
                [0.18, 0.14, 0.08, 0.012], ebony, root)
        tapered('lower cheek spine', [(side * 0.5, -2.58, 3.7), (side * 0.91, -2.18, 3.56),
                                      (side * 1.11, -1.85, 3.75)], [0.12, 0.08, 0.01], ebony, root)
        sphere('nostril', (side * 0.22, -3.61, 3.69), (0.07, 0.03, 0.04), purple, root)
        for fore in (-0.8, 0.86):
            x = side * 0.7
            y = fore
            tapered('muscular leg', [(x, y, 2.12), (x * 1.12, y + 0.2, 1.43),
                                    (x * 1.22, y - 0.1, 0.72)], [0.36, 0.3, 0.24], ebony, root)
            sphere('clawed foot', (x * 1.23, y - 0.28, 0.53), (0.36, 0.5, 0.17), purple, root)
            for claw in range(3):
                cone_obj = cone('ivory claw', (x * 1.23 + (claw - 1) * 0.18, y - 0.66, 0.47), 0.075, 0.33, gold, root, 12)
                cone_obj.rotation_euler[0] = math.pi / 2

    tail = [(0, 1.0, 2.1), (0.1, 1.95, 1.9), (0.34, 2.75, 1.65),
            (0.11, 3.58, 1.45), (-0.25, 4.1, 1.49), (-0.6, 4.55, 1.78)]
    tapered('serpentine tail', tail, [0.53, 0.45, 0.32, 0.21, 0.12, 0.015], ebony, root, 18)
    sheet('arrow tail fin', [(-0.6, 4.55, 1.78), (-1.03, 4.76, 2.04),
                             (-0.96, 4.89, 1.44), (-0.6, 4.55, 1.78)], [(0, 1, 2)], purple, root, 0.08)
    for index in range(8):
        y = -1.2 + index * 0.53
        cone('jagged back spine', (0, y, 3.15 - 0.1 * index), 0.18 - index * 0.008,
             0.6 - index * 0.027, purple, root, 9)

    for side, name in ((-1, 'Wing_L'), (1, 'Wing_R')):
        pivot = empty(name, (side * 0.72, 0.03, 2.91), root)
        vertices = [(0, 0, 0), (side * 1.38, -0.49, 1.15), (side * 3.3, -0.22, 1.67),
                    (side * 4.55, 0.19, 1.25), (side * 4.2, 0.65, 0.03),
                    (side * 3.34, 0.82, 0.5), (side * 2.67, 1.05, -0.54),
                    (side * 1.91, 0.71, 0.12), (side * 1.15, 1.11, -0.73),
                    (side * 0.41, 0.78, -0.21)]
        sheet('scalloped bat wing membrane', vertices,
              [(0, 1, 9), (1, 2, 7, 8, 9), (2, 3, 4, 5, 6, 7)], wing, pivot, 0.065)
        for end in (2, 3, 5, 7, 8):
            tube('black wing finger', [(0, 0, 0), (side * 1.3, -0.32, 0.75), vertices[end]],
                 0.065 if end in (2, 3) else 0.045, ebony, pivot, 3)
        tube('gold wing leading edge', [(0, 0, 0), (side * 1.38, -0.49, 1.15),
                                        (side * 3.3, -0.22, 1.67), (side * 4.55, 0.19, 1.25)],
             0.08, gold, pivot)

    root.rotation_euler[2] = math.pi
    export('maleficent-dragon.glb')


if __name__ == '__main__':
    build_racer()
    build_dragon()
