import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = 'CreateAgent.ai <noreply@createagents.ai>'

export async function sendWelcomeEmail(email, name) {
  const firstName = (name || 'there').split(' ')[0]
  try {
    await resend.emails.send({
      from: FROM,
      to: email,
      subject: 'Welcome to CreateAgent.ai — your first agent awaits 🚀',
      html: `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAF7F0;font-family:'Outfit',Helvetica,Arial,sans-serif">
<div style="max-width:600px;margin:0 auto;padding:40px 20px">
  <div style="background:#C44B2C;border-radius:16px 16px 0 0;padding:32px;text-align:center">
    <div style="width:48px;height:48px;background:white;border-radius:12px;display:inline-flex;align-items:center;justify-content:center;font-weight:bold;font-size:24px;color:#C44B2C">C</div>
    <h1 style="color:white;font-size:24px;margin:16px 0 0;font-family:'Georgia',serif">Welcome to CreateAgent.ai</h1>
  </div>
  <div style="background:white;padding:32px;border-radius:0 0 16px 16px">
    <p style="font-size:16px;color:#1B3A2D;margin:0 0 20px">Hi ${firstName},</p>
    <p style="font-size:14px;color:#555;line-height:1.6;margin:0 0 24px">You've just joined the platform where anyone can build and deploy real AI agents using plain English. No code needed.</p>
    <div style="margin:0 0 24px">
      <div style="display:flex;align-items:flex-start;margin:0 0 16px">
        <span style="display:inline-block;width:28px;height:28px;background:#FAF7F0;border-radius:50%;text-align:center;line-height:28px;font-size:14px;margin-right:12px;flex-shrink:0">1</span>
        <div><strong style="color:#1B3A2D;font-size:14px">Browse 96 ready-to-run agents</strong><br><span style="font-size:13px;color:#888">Healthcare, finance, legal, marketing, and 14 more verticals</span></div>
      </div>
      <div style="display:flex;align-items:flex-start;margin:0 0 16px">
        <span style="display:inline-block;width:28px;height:28px;background:#FAF7F0;border-radius:50%;text-align:center;line-height:28px;font-size:14px;margin-right:12px;flex-shrink:0">2</span>
        <div><strong style="color:#1B3A2D;font-size:14px">Deploy with one click</strong><br><span style="font-size:13px;color:#888">Pick any agent and it's instantly added to your workspace</span></div>
      </div>
      <div style="display:flex;align-items:flex-start;margin:0 0 16px">
        <span style="display:inline-block;width:28px;height:28px;background:#FAF7F0;border-radius:50%;text-align:center;line-height:28px;font-size:14px;margin-right:12px;flex-shrink:0">3</span>
        <div><strong style="color:#1B3A2D;font-size:14px">Run it and see real results</strong><br><span style="font-size:13px;color:#888">Give your agent a task in plain English and watch the magic</span></div>
      </div>
    </div>
    <a href="https://createagents.ai/templates" style="display:block;background:#C44B2C;color:white;text-decoration:none;text-align:center;padding:14px 24px;border-radius:12px;font-size:14px;font-weight:600">Browse 96 Ready-to-Run Agents &rarr;</a>
    <p style="font-size:12px;color:#aaa;margin:24px 0 0;text-align:center">You received this because you signed up at createagents.ai</p>
  </div>
</div>
</body></html>`,
    })
  } catch (err) {
    console.error('Welcome email failed:', err)
  }
}

export async function sendAgentDeployedEmail(email, name, agentName, agentId, vertical) {
  const firstName = (name || 'there').split(' ')[0]
  try {
    await resend.emails.send({
      from: FROM,
      to: email,
      subject: `Your ${agentName} is live and ready to run ✨`,
      html: `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAF7F0;font-family:'Outfit',Helvetica,Arial,sans-serif">
<div style="max-width:600px;margin:0 auto;padding:40px 20px">
  <div style="background:#1B3A2D;border-radius:16px 16px 0 0;padding:32px;text-align:center">
    <div style="font-size:48px;margin-bottom:8px">🤖</div>
    <h1 style="color:white;font-size:22px;margin:0;font-family:'Georgia',serif">${agentName} is Live!</h1>
    <p style="color:rgba(255,255,255,0.6);font-size:13px;margin:8px 0 0">${vertical}</p>
  </div>
  <div style="background:white;padding:32px;border-radius:0 0 16px 16px">
    <p style="font-size:16px;color:#1B3A2D;margin:0 0 16px">Hey ${firstName},</p>
    <p style="font-size:14px;color:#555;line-height:1.6;margin:0 0 24px">Your <strong>${agentName}</strong> agent has been deployed to your workspace and is ready to run. Give it a task and see what it can do.</p>
    <a href="https://createagents.ai/agent/${agentId}" style="display:block;background:#C44B2C;color:white;text-decoration:none;text-align:center;padding:14px 24px;border-radius:12px;font-size:14px;font-weight:600">Run Your Agent Now &rarr;</a>
    <p style="font-size:12px;color:#aaa;margin:24px 0 0;text-align:center">You received this because you deployed an agent at createagents.ai</p>
  </div>
</div>
</body></html>`,
    })
  } catch (err) {
    console.error('Agent deployed email failed:', err)
  }
}

export async function sendRunCompleteEmail(email, name, agentName, runId, outputPreview) {
  const firstName = (name || 'there').split(' ')[0]
  const preview = outputPreview?.slice(0, 200) || 'Your agent produced results.'
  try {
    await resend.emails.send({
      from: FROM,
      to: email,
      subject: `${agentName} just completed a run`,
      html: `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAF7F0;font-family:'Outfit',Helvetica,Arial,sans-serif">
<div style="max-width:600px;margin:0 auto;padding:40px 20px">
  <div style="background:white;border-radius:16px;padding:32px;border:1px solid #eee">
    <p style="font-size:16px;color:#1B3A2D;margin:0 0 12px">Hi ${firstName},</p>
    <p style="font-size:14px;color:#555;line-height:1.6;margin:0 0 16px"><strong>${agentName}</strong> just finished running. Here's a preview:</p>
    <div style="background:#FAF7F0;padding:16px;border-radius:8px;font-size:13px;color:#333;line-height:1.6;margin:0 0 20px">${preview}...</div>
    <a href="https://createagents.ai/runs" style="display:inline-block;background:#1B3A2D;color:white;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:600">View Full Output &rarr;</a>
  </div>
</div>
</body></html>`,
    })
  } catch (err) {
    console.error('Run complete email failed:', err)
  }
}

export async function sendSessionRecapEmail(email, name, activities) {
  const firstName = (name || 'there').split(' ')[0]
  const { agentsCreated = 0, agentsDeployed = 0, runsCompleted = 0, filesUploaded = 0 } = activities

  // Only send if there was actual activity
  if (agentsCreated + agentsDeployed + runsCompleted + filesUploaded === 0) return

  const activityLines = []
  if (agentsCreated > 0) activityLines.push(`Created ${agentsCreated} new agent${agentsCreated > 1 ? 's' : ''}`)
  if (agentsDeployed > 0) activityLines.push(`Deployed ${agentsDeployed} agent${agentsDeployed > 1 ? 's' : ''} from the library`)
  if (runsCompleted > 0) activityLines.push(`Ran your agents ${runsCompleted} time${runsCompleted > 1 ? 's' : ''}`)
  if (filesUploaded > 0) activityLines.push(`Uploaded ${filesUploaded} file${filesUploaded > 1 ? 's' : ''}`)

  const activityHtml = activityLines.map(a =>
    `<div style="display:flex;align-items:center;gap:8px;margin:0 0 8px"><span style="color:#C44B2C">&#10003;</span><span style="font-size:14px;color:#333">${a}</span></div>`
  ).join('')

  try {
    await resend.emails.send({
      from: FROM,
      to: email,
      subject: `Your CreateAgent.ai session recap — ${activityLines.length} thing${activityLines.length > 1 ? 's' : ''} done today`,
      html: `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAF7F0;font-family:'Outfit',Helvetica,Arial,sans-serif">
<div style="max-width:600px;margin:0 auto;padding:40px 20px">
  <div style="background:white;border-radius:16px;padding:32px;border:1px solid #eee">
    <div style="text-align:center;margin-bottom:24px">
      <div style="width:40px;height:40px;background:#C44B2C;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:18px">C</div>
    </div>
    <p style="font-size:18px;color:#1B3A2D;margin:0 0 8px;font-family:'Georgia',serif;font-weight:bold">Nice work today, ${firstName}!</p>
    <p style="font-size:14px;color:#555;line-height:1.6;margin:0 0 20px">Here&rsquo;s what you accomplished on CreateAgent.ai:</p>

    <div style="background:#FAF7F0;padding:20px;border-radius:12px;margin:0 0 24px">
      ${activityHtml}
    </div>

    <p style="font-size:14px;color:#555;line-height:1.6;margin:0 0 20px">Ready to do more? Your agents are waiting for you.</p>

    <div style="text-align:center">
      <a href="https://createagents.ai/dashboard" style="display:inline-block;background:#C44B2C;color:white;text-decoration:none;padding:12px 32px;border-radius:10px;font-size:14px;font-weight:600">Continue Building &rarr;</a>
    </div>

    <div style="margin-top:24px;padding-top:16px;border-top:1px solid #eee;text-align:center">
      <a href="https://createagents.ai/templates" style="font-size:12px;color:#C44B2C;text-decoration:none">Browse 96 ready-to-run agents</a>
      <span style="color:#ddd;margin:0 8px">|</span>
      <a href="https://createagents.ai/build" style="font-size:12px;color:#C44B2C;text-decoration:none">Build a custom agent</a>
    </div>

    <p style="font-size:11px;color:#bbb;margin:20px 0 0;text-align:center">You received this because you used createagents.ai today.</p>
  </div>
</div>
</body></html>`,
    })
  } catch (err) {
    console.error('Session recap email failed:', err)
  }
}
