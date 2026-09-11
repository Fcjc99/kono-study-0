from pathlib import Path
import re, math
ROOT=Path(__file__).resolve().parents[1]
mascot=(ROOT/'src/game/systems/KonoMascotSystem.ts').read_text()
app=(ROOT/'src/App.tsx').read_text()
css=(ROOT/'src/App.css').read_text()
coord=(ROOT/'src/game/evolution/EvolutionCoordinator.ts').read_text()

# Required hard-safety features
assert 'const POND_EXCLUSION' in mascot, 'missing pond exclusion zone'
assert 'isWalkablePoint(proposed)' in mascot, 'missing runtime water guard'
assert "'pond-north': { x: 0.575, y: 0.545 }" in mascot
assert "'pond-south-east': { x: 0.670, y: 0.735 }" in mascot
assert "this.navigateToNode('house')" in mascot
assert 'idleReactionForNode' in mascot

# Completion timing / evolution polish
assert '},520)' in app, 'completion timer is not 520ms'
assert 'Array.from({length:4}' in app, 'completion particle count not reduced to 4'
assert 'width:58px;height:58px' in css, 'completion star is not compact'
assert 'animation:bubble-celebrate .46s' in css, 'completion animation timing mismatch'
assert 'const delay = this.reducedMotion ? 100 : 760' in coord, 'evolution queue timing mismatch'
assert 'const moteCount = 2' in coord, 'evolution accent still too busy'

# Segment-level pond exclusion validation for the production nav network.
nodes={
'house':(.282,.525),'mailbox':(.312,.500),'garden':(.250,.650),'west-junction':(.392,.555),
'north-west':(.420,.492),'north-center':(.545,.474),'cherry':(.500,.365),'terrace-entry':(.680,.485),
'lanterns':(.748,.455),'pond-north':(.575,.545),'pond-west':(.390,.650),'pond-south-west':(.425,.715),
'bridge':(.505,.755),'pond-south-east':(.670,.735),'pond-east':(.720,.640),
}
graph={
'house':['mailbox','west-junction','garden'],'mailbox':['house','west-junction'],'garden':['house','pond-west'],
'west-junction':['house','mailbox','north-west','pond-west'],'north-west':['west-junction','north-center'],
'north-center':['north-west','cherry','pond-north','terrace-entry'],'cherry':['north-center'],
'terrace-entry':['north-center','lanterns','pond-east'],'lanterns':['terrace-entry'],'pond-north':['north-center'],
'pond-west':['garden','west-junction','pond-south-west'],'pond-south-west':['pond-west','bridge'],
'bridge':['pond-south-west','pond-south-east'],'pond-south-east':['bridge','pond-east'],
'pond-east':['pond-south-east','terrace-entry'],
}
cx,cy,rx,ry=.555,.635,.155,.085

def safe(p):
    x,y=p
    nx=(x-cx)/rx; ny=(y-cy)/ry
    return nx*nx+ny*ny >= 1

seen=set()
for a, bs in graph.items():
    for b in bs:
        key=tuple(sorted((a,b)))
        if key in seen: continue
        seen.add(key)
        pa,pb=nodes[a],nodes[b]
        for i in range(101):
            t=i/100
            p=(pa[0]+(pb[0]-pa[0])*t, pa[1]+(pb[1]-pa[1])*t)
            assert safe(p), f'water-crossing nav edge: {a} -> {b} at {p}'

# Approved terrace must remain present; this build does not modify it.
terrace=ROOT/'public/garden/evolution/lanterns/phases/afternoon/terrace-stage-5.png'
assert terrace.exists(), 'approved terrace asset missing'
print('Build 22.7.0 validation passed.')
