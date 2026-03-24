import Link from 'next/link'
import { getVerticalEmoji, getVerticalLabel, statusColor } from '@/lib/utils'

export default function AgentCard({ agent, onQuickRun }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-lg hover:border-terracotta/20 transition-all group">
      <div className="flex items-start justify-between mb-3">
        <div className="w-11 h-11 rounded-xl bg-cream flex items-center justify-center text-xl">
          {getVerticalEmoji(agent.vertical)}
        </div>
        <span
          className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${statusColor(
            agent.status
          )}`}
        >
          {agent.status}
        </span>
      </div>

      <Link href={`/agent/${agent.id}`}>
        <h3 className="font-serif text-lg font-bold text-forest group-hover:text-terracotta transition-colors mb-1">
          {agent.name}
        </h3>
      </Link>

      <p className="text-sm text-gray-500 mb-3 line-clamp-2">
        {agent.description}
      </p>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span>{getVerticalLabel(agent.vertical)}</span>
          <span>·</span>
          <span>{agent.run_count || 0} runs</span>
        </div>
        <button
          onClick={(e) => {
            e.preventDefault()
            onQuickRun?.(agent)
          }}
          className="text-xs font-medium text-terracotta hover:bg-terracotta hover:text-white px-3 py-1.5 rounded-lg border border-terracotta/30 transition-all"
        >
          Run ▸
        </button>
      </div>
    </div>
  )
}
