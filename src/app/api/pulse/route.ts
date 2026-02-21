/**
 * PULSE Platform API Route
 * Unified API for all platform operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPulse } from '@/lib/pulse';

// Initialize platform on first request
let initialized = false;

async function ensureInitialized() {
  if (!initialized) {
    const pulse = getPulse();
    await pulse.initialize();
    initialized = true;
  }
}

export async function GET(request: NextRequest) {
  await ensureInitialized();

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  const pulse = getPulse();

  try {
    switch (action) {
      case 'status':
        return NextResponse.json({
          success: true,
          data: pulse.getStatus(),
        });

      case 'comprehensive':
        return NextResponse.json({
          success: true,
          data: pulse.getComprehensiveStatus(),
        });

      case 'resources':
        return NextResponse.json({
          success: true,
          data: pulse.getCurrentResources(),
        });

      case 'modules':
        return NextResponse.json({
          success: true,
          data: pulse.getModules(),
        });

      case 'agents':
        return NextResponse.json({
          success: true,
          data: pulse.getAgents(),
        });

      case 'models':
        return NextResponse.json({
          success: true,
          data: pulse.getModelProviders(),
        });

      case 'logs':
        const logLimit = parseInt(searchParams.get('limit') || '100');
        return NextResponse.json({
          success: true,
          data: pulse.getLogs(logLimit),
        });

      case 'metrics':
        const metricLimit = parseInt(searchParams.get('limit') || '100');
        return NextResponse.json({
          success: true,
          data: pulse.getMetrics(metricLimit),
        });

      case 'audit':
        const auditLimit = parseInt(searchParams.get('limit') || '100');
        return NextResponse.json({
          success: true,
          data: pulse.getAuditLogs(auditLimit),
        });

      case 'failures':
        const failureLimit = parseInt(searchParams.get('limit') || '50');
        return NextResponse.json({
          success: true,
          data: pulse.getFailures(failureLimit),
        });

      case 'checkpoints':
        return NextResponse.json({
          success: true,
          data: pulse.getCheckpoints(),
        });

      case 'dashboard':
        return NextResponse.json({
          success: true,
          data: pulse.getDashboardData(),
        });

      default:
        // Return comprehensive status by default
        return NextResponse.json({
          success: true,
          data: pulse.getComprehensiveStatus(),
        });
    }
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  await ensureInitialized();

  const body = await request.json();
  const { action, ...params } = body;

  const pulse = getPulse();

  try {
    switch (action) {
      case 'pause':
        const pauseResult = await pulse.pause();
        return NextResponse.json({ success: pauseResult });

      case 'resume':
        const resumeResult = await pulse.resume();
        return NextResponse.json({ success: resumeResult });

      case 'shutdown':
        await pulse.shutdown();
        return NextResponse.json({ success: true });

      case 'chat':
        const chatResponse = await pulse.chat(params.request);
        return NextResponse.json({
          success: true,
          data: chatResponse,
        });

      case 'generateImage':
        const imageData = await pulse.generateImage(params.prompt, params.size);
        return NextResponse.json({
          success: true,
          data: imageData,
        });

      case 'spawnAgent':
        const agent = pulse.spawnAgent(params.name, params.type, params.config);
        return NextResponse.json({
          success: true,
          data: agent,
        });

      case 'terminateAgent':
        const terminateResult = pulse.terminateAgent(params.agentId);
        return NextResponse.json(terminateResult);

      case 'installModule':
        const installResult = await pulse.installModule(params.manifest, params.sourcePath);
        return NextResponse.json(installResult);

      case 'uninstallModule':
        const uninstallResult = await pulse.uninstallModule(params.moduleId);
        return NextResponse.json(uninstallResult);

      case 'setBudget':
        const budget = pulse.setResourceBudget(
          params.entityType,
          params.entityId,
          params.budget
        );
        return NextResponse.json({
          success: true,
          data: budget,
        });

      case 'checkPermission':
        const permResult = pulse.checkPermission(
          params.entityType,
          params.entityId,
          params.permission
        );
        return NextResponse.json(permResult);

      case 'registerPolicy':
        pulse.registerPolicy(params.policy);
        return NextResponse.json({ success: true });

      case 'submitEvent':
        const event = pulse.submitEvent(params.event);
        return NextResponse.json({
          success: true,
          data: event,
        });

      case 'submitTask':
        const taskId = pulse.submitTask(params.task, params.executor);
        return NextResponse.json({
          success: true,
          data: { taskId },
        });

      case 'cancelTask':
        const cancelResult = pulse.cancelTask(params.taskId);
        return NextResponse.json({ success: cancelResult });

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
