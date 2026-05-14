'use strict';

const express = require('express');
const router = express.Router();

const projectViewController = require('../controllers/project-view.controller');

router.post('/track', projectViewController.trackProjectView);
router.get('/stats', projectViewController.getProjectViewStats);

module.exports = router;
