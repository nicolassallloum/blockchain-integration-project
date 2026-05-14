#!/bin/bash
set -e

FILE="blockchain-api/src/controllers/project-view.controller.js"

echo "Backup controller..."
cp "$FILE" "$FILE.bak_final_ip_fix_$(date +%Y%m%d_%H%M%S)"

cat > "$FILE" <<'EOF2'
'use strict';

const db = require('../config/database');

let tableReady = false;

async function ensureProjectViewTable() {
  if (tableReady) {
    return;
  }

  await db.query(`
    CREATE SCHEMA IF NOT EXISTS blockchain;

    CREATE TABLE IF NOT EXISTS blockchain.project_view_logs (
      view_id BIGSERIAL PRIMARY KEY,
      page_url TEXT NOT NULL,
      page_title TEXT,
      source_system VARCHAR(100) DEFAULT 'BLOCKCHAIN_TEST_UI',
      viewer_ip VARCHAR(100),
      user_agent TEXT,
      session_id VARCHAR(200),
      referrer TEXT,
      viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    ALTER TABLE blockchain.project_view_logs
      ADD COLUMN IF NOT EXISTS referrer TEXT;

    CREATE INDEX IF NOT EXISTS idx_project_view_logs_viewed_at
      ON blockchain.project_view_logs(viewed_at);

    CREATE INDEX IF NOT EXISTS idx_project_view_logs_session_id
      ON blockchain.project_view_logs(session_id);

    CREATE INDEX IF NOT EXISTS idx_project_view_logs_page_url
      ON blockchain.project_view_logs(page_url);
  `);

  tableReady = true;
}

function cleanIp(value) {
  if (!value) {
    return null;
  }

  return String(value)
    .replace('::ffff:', '')
    .split(',')[0]
    .trim();
}

function getClientIp(req) {
  /*
   * Priority:
   * 1. viewerIp from request body
   * 2. viewer_ip from request body
   * 3. x-viewer-ip custom header
   * 4. x-forwarded-for
   * 5. x-real-ip
   * 6. socket IP
   */

  const bodyViewerIp = cleanIp(req.body?.viewerIp);
  if (bodyViewerIp) {
    return bodyViewerIp;
  }

  const bodyViewerIpSnake = cleanIp(req.body?.viewer_ip);
  if (bodyViewerIpSnake) {
    return bodyViewerIpSnake;
  }

  const headerViewerIp = cleanIp(req.headers['x-viewer-ip']);
  if (headerViewerIp) {
    return headerViewerIp;
  }

  const forwardedFor = cleanIp(req.headers['x-forwarded-for']);
  if (forwardedFor) {
    return forwardedFor;
  }

  const realIp = cleanIp(req.headers['x-real-ip']);
  if (realIp) {
    return realIp;
  }

  return cleanIp(req.socket?.remoteAddress || req.ip);
}

exports.trackProjectView = async (req, res, next) => {
  try {
    await ensureProjectViewTable();

    const pageUrl = String(req.body?.pageUrl || req.body?.page_url || '').trim();
    const pageTitle = String(req.body?.pageTitle || req.body?.page_title || '').trim();
    const sourceSystem = String(req.body?.sourceSystem || req.body?.source_system || 'BLOCKCHAIN_TEST_UI').trim();
    const sessionId = String(req.body?.sessionId || req.body?.session_id || req.headers['x-session-id'] || '').trim();
    const referrer = String(req.body?.referrer || req.headers.referer || req.headers.referrer || '').trim();
    const viewerIp = getClientIp(req);

    if (!pageUrl) {
      return res.status(400).json({
        success: false,
        message: 'pageUrl is required',
        errorCode: 'PAGE_URL_REQUIRED',
        data: null,
        timestamp: new Date().toISOString(),
        requestId: req.requestId || null,
        correlationId: req.correlationId || req.requestId || null
      });
    }

    const result = await db.query(
      `
      INSERT INTO blockchain.project_view_logs (
        page_url,
        page_title,
        source_system,
        viewer_ip,
        user_agent,
        session_id,
        referrer
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING
        view_id,
        page_url,
        page_title,
        source_system,
        viewer_ip,
        session_id,
        viewed_at
      `,
      [
        pageUrl,
        pageTitle || null,
        sourceSystem || 'BLOCKCHAIN_TEST_UI',
        viewerIp,
        req.headers['user-agent'] || null,
        sessionId || null,
        referrer || null
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'Project view tracked successfully',
      data: result.rows[0],
      timestamp: new Date().toISOString(),
      requestId: req.requestId || null,
      correlationId: req.correlationId || req.requestId || null
    });
  } catch (error) {
    return next(error);
  }
};

exports.getProjectViewStats = async (req, res, next) => {
  try {
    await ensureProjectViewTable();

    const statsResult = await db.query(`
      SELECT
        COUNT(*)::BIGINT AS total_views,
        COUNT(*) FILTER (
          WHERE viewed_at >= CURRENT_DATE
            AND viewed_at < CURRENT_DATE + INTERVAL '1 day'
        )::BIGINT AS today_views,
        COUNT(
          DISTINCT COALESCE(
            NULLIF(session_id, ''),
            COALESCE(viewer_ip, '') || '|' || COALESCE(user_agent, '')
          )
        )::BIGINT AS unique_visitors,
        MAX(viewed_at) AS last_viewed_at
      FROM blockchain.project_view_logs
    `);

    const pagesResult = await db.query(`
      SELECT
        page_url,
        COALESCE(MAX(page_title), '') AS page_title,
        COUNT(*)::BIGINT AS view_count,
        MAX(viewed_at) AS last_viewed_at
      FROM blockchain.project_view_logs
      GROUP BY page_url
      ORDER BY COUNT(*) DESC, MAX(viewed_at) DESC
      LIMIT 10
    `);

    const row = statsResult.rows[0] || {};

    return res.status(200).json({
      success: true,
      message: 'Project view stats loaded successfully',
      data: {
        totalViews: Number(row.total_views || 0),
        todayViews: Number(row.today_views || 0),
        uniqueVisitors: Number(row.unique_visitors || 0),
        lastViewedAt: row.last_viewed_at || null,
        mostViewedPages: pagesResult.rows.map((page) => ({
          pageUrl: page.page_url,
          pageTitle: page.page_title,
          viewCount: Number(page.view_count || 0),
          lastViewedAt: page.last_viewed_at
        }))
      },
      source: 'blockchain.project_view_logs',
      timestamp: new Date().toISOString(),
      requestId: req.requestId || null,
      correlationId: req.correlationId || req.requestId || null
    });
  } catch (error) {
    return next(error);
  }
};
EOF2

node -c "$FILE"

echo "DONE: Backend controller fixed."
