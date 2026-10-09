import { projects } from '../../../../data/resume'
import Hangfire from './Hangfire'
import Switchboard from './Switchboard'
import Gates from './Gates'
import Press from './Press'
import Dispatch from './Dispatch'

// The five "counts are the content" machines, one inside each project card's DOM slot:
//   hangfire     24-tooth ring that snaps a tooth every 0.5 s and throws 12 sparks per tick
//   agent-crm    30 × 15 switchboard of 450 terminals with a roaming "active agent"
//   ess          1,000 tokens (tier-scaled) streaming through three named entity gates
//   knitting     a press stamping PDF / EXCEL / CRYSTAL sheets onto four module stacks
//   prime-delay  200 envelopes launched once a day into a 20 × 10 inbox grid
// No lights of their own: the scene's crater / rim / smash lights and the env map light them, and every landing
// flash is carried by the machine's shockwave rings plus the DOM card flash (fewer lights = cheaper fragments).
const MACHINES = { hangfire: Hangfire, 'agent-crm': Switchboard, ess: Gates, knitting: Press, 'prime-delay': Dispatch }

export default function Machines({ tier }) {
  return (
    <>
      {projects.map((p, i) => {
        const M = MACHINES[p.id]
        return M ? <M key={p.id} tier={tier} order={i} /> : null
      })}
    </>
  )
}
