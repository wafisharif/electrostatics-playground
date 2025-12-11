// ==========================
// GLOBALS
// ==========================

let particles = [];
let activeTool = null;        
let selectedParticle = null;
let dragging = false;

let canvasWidth = 1000;
let canvasHeight = 600;

// Flags for instruction overlay
let hasPlacedParticle = false;

// Visualization toggles
let showElectricField = false;
let showFieldLines = false;

// Physics parameters
let globalFriction = 0.02;
let kCoulomb = 800;
let minDistance = 8;

// Streamline settings
let numLinesPerCharge = 32;        // VERY dense
let streamlineStep = 2.2;
let maxStreamlineLen = 600;



// ==========================
// PARTICLE CLASS
// ==========================
class Particle {
  constructor(x, y, charge) {
    this.pos = createVector(x, y);
    this.vel = createVector(0, 0);
    this.acc = createVector(0, 0);

    this.charge = charge; 
    this.mass = 1;
    this.radius = 5;

    this.color = (charge > 0)
      ? color(80, 180, 255)
      : color(255, 90, 120);
  }

  applyForce(force) {
    const f = p5.Vector.div(force, this.mass);
    this.acc.add(f);
  }

  update() {
    this.vel.mult(1 - globalFriction);
    this.vel.add(this.acc);
    this.pos.add(this.vel);

    this.acc.set(0, 0);
    this.handleEdges();
  }

  handleEdges() {
    if (this.pos.x < 0) { this.pos.x = 0; this.vel.x *= -1; }
    else if (this.pos.x > canvasWidth) { this.pos.x = canvasWidth; this.vel.x *= -1; }

    if (this.pos.y < 0) { this.pos.y = 0; this.vel.y *= -1; }
    else if (this.pos.y > canvasHeight) { this.pos.y = canvasHeight; this.vel.y *= -1; }
  }

  draw() {
    noStroke();
    fill(this.color);
    circle(this.pos.x, this.pos.y, this.radius * 2);
  }
}



// ==========================
// COULOMB FORCE
// ==========================
function applyCoulombForces() {
  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {

      const p1 = particles[i];
      const p2 = particles[j];

      let rVec = p5.Vector.sub(p1.pos, p2.pos);
      let r = rVec.mag();
      if (r < minDistance) r = minDistance;

      let rHat = rVec.copy().div(r);
      let forceMag = (kCoulomb * p1.charge * p2.charge) / (r * r);
      let force = rHat.copy().mult(forceMag);

      p1.applyForce(force);
      p2.applyForce(force.copy().mult(-1));
    }
  }
}



// ==========================
// ELECTRIC FIELD CALC
// ==========================
function computeElectricFieldAtPoint(x, y) {
  let Ex = 0, Ey = 0;

  for (let p of particles) {
    let rx = x - p.pos.x;
    let ry = y - p.pos.y;
    let r2 = rx*rx + ry*ry;

    if (r2 < minDistance*minDistance) continue;

    let r = Math.sqrt(r2);
    let E = (kCoulomb * p.charge) / r2;

    Ex += E * (rx / r);
    Ey += E * (ry / r);
  }

  return createVector(Ex, Ey);
}



// ==========================
// FIELD LINE TRACING
// ==========================
function traceStreamline(startX, startY) {
  let pts = [];
  let x = startX, y = startY;

  for (let i = 0; i < maxStreamlineLen; i++) {

    let E = computeElectricFieldAtPoint(x, y);
    let mag = E.mag();

    if (mag < 0.01) break;

    let dir = E.copy().normalize();
    x += dir.x * streamlineStep;
    y += dir.y * streamlineStep;

    pts.push([x, y]);

    if (x < 0 || x > width || y < 0 || y > height) break;

    for (let p of particles) {
      if (p.charge < 0) {
        if (dist(x, y, p.pos.x, p.pos.y) < p.radius + 4) {
          return pts;
        }
      }
    }
  }

  return pts;
}


function drawFieldLines() {
  stroke(255, 255, 180, 90);
  strokeWeight(1);

  for (let p of particles) {
    if (p.charge <= 0) continue;

    for (let n = 0; n < numLinesPerCharge; n++) {

      let angle = (TWO_PI * n) / numLinesPerCharge;
      let startX = p.pos.x + Math.cos(angle) * (p.radius + 1);
      let startY = p.pos.y + Math.sin(angle) * (p.radius + 1);

      let path = traceStreamline(startX, startY);

      noFill();
      beginShape();
      for (let pt of path) vertex(pt[0], pt[1]);
      endShape();
    }
  }
}



// ==========================
// FIELD VECTORS (existing)
// ==========================
function drawElectricField() {
  let spacing = 30;
  stroke(180, 180, 220, 120);
  strokeWeight(1);

  for (let x = spacing/2; x < width; x += spacing) {
    for (let y = spacing/2; y < height; y += spacing) {

      let E = computeElectricFieldAtPoint(x, y);
      let scale = 0.0008;

      let ex = E.x * scale;
      let ey = E.y * scale;

      line(x, y, x + ex, y + ey);

      push();
      translate(x + ex, y + ey);
      rotate(atan2(ey, ex));
      line(0, 0, -5, -2);
      line(0, 0, -5, 2);
      pop();
    }
  }
}



// ==========================
// SETUP + DRAW
// ==========================
function setup() {
  let canvas = createCanvas(canvasWidth, canvasHeight);
  canvas.parent("canvas-container");

  frameRate(60);
  smooth();

  bindUI();
}


function draw() {
  background(5, 7, 10);

  if (!hasPlacedParticle) drawOverlayInstruction();

  if (showElectricField) drawElectricField();
  if (showFieldLines) drawFieldLines();

  applyCoulombForces();

  for (let p of particles) {
    p.update();
    p.draw();
  }

  updateInfoPanel();
}



// ==========================
// OVERLAY
// ==========================
function drawOverlayInstruction() {
  push();
  fill(200, 200, 200, 80);
  textAlign(CENTER, CENTER);
  textSize(18);
  text("Select a tool, then click on the canvas to place particles",
       width / 2, height / 2);
  pop();
}



// ==========================
// UI BINDINGS
// ==========================
function bindUI() {

  setToolButton("tool-add-plus", "addPlus");
  setToolButton("tool-add-minus", "addMinus");
  setToolButton("tool-add-random", "addRandom");
  setToolButton("tool-select", "select");
  setToolButton("tool-erase", "erase");

  document.getElementById("tool-clear").onclick = () => {
    particles = [];
  };

  const fieldBtn = document.getElementById("toggle-field");
  fieldBtn.onclick = () => {
    showElectricField = !showElectricField;
    fieldBtn.classList.toggle("active", showElectricField);
  };

  const lineBtn = document.getElementById("toggle-lines");
  lineBtn.onclick = () => {
    showFieldLines = !showFieldLines;
    lineBtn.classList.toggle("active", showFieldLines);
  };

  const sliderK = document.getElementById("slider-k");
  sliderK.oninput = () => {
    kCoulomb = Number(sliderK.value);
    document.getElementById("value-k").innerText = kCoulomb;
  };

  const sliderFriction = document.getElementById("slider-friction");
  sliderFriction.oninput = () => {
    globalFriction = Number(sliderFriction.value);
    document.getElementById("value-friction").innerText =
      globalFriction.toFixed(3);
  };

  const sliderMinDist = document.getElementById("slider-minDist");
  sliderMinDist.oninput = () => {
    minDistance = Number(sliderMinDist.value);
    document.getElementById("value-minDist").innerText = minDistance;
  };
}



// ==========================
// TOOL SELECTION
// ==========================
function setToolButton(id, toolName) {
  const btn = document.getElementById(id);

  btn.onclick = () => {
    activeTool = toolName;
    highlightActiveTool();
  };
}


function highlightActiveTool() {
  const btns = document.getElementsByClassName("tool-btn");
  for (let b of btns) b.classList.remove("active");

  if (!activeTool) return;

  if (activeTool === "addPlus") document.getElementById("tool-add-plus").classList.add("active");
  if (activeTool === "addMinus") document.getElementById("tool-add-minus").classList.add("active");
  if (activeTool === "addRandom") document.getElementById("tool-add-random").classList.add("active");
  if (activeTool === "select") document.getElementById("tool-select").classList.add("active");
  if (activeTool === "erase") document.getElementById("tool-erase").classList.add("active");
}



// ==========================
// MOUSE INTERACTION
// ==========================
function mousePressed() {
  if (!mouseInCanvas()) return;

  if (activeTool === "addPlus") {
    addParticle(mouseX, mouseY, +1);
    hasPlacedParticle = true;
  }
  else if (activeTool === "addMinus") {
    addParticle(mouseX, mouseY, -1);
    hasPlacedParticle = true;
  }
  else if (activeTool === "addRandom") {
    addParticle(mouseX, mouseY, random([1, -1]));
    hasPlacedParticle = true;
  }
  else if (activeTool === "erase") {
    deleteParticleAt(mouseX, mouseY);
  }
  else if (activeTool === "select") {
    selectedParticle = getParticleAt(mouseX, mouseY);
    dragging = Boolean(selectedParticle);
  }
}

function mouseDragged() {
  if (activeTool === "select" && dragging && selectedParticle) {
    selectedParticle.pos.set(mouseX, mouseY);
  }
}

function mouseReleased() {
  dragging = false;
  selectedParticle = null;
}



// ==========================
// PARTICLE MGMT
// ==========================
function addParticle(x, y, charge) {
  particles.push(new Particle(x, y, charge));
}

function getParticleAt(x, y) {
  for (let p of particles) {
    if (dist(x, y, p.pos.x, p.pos.y) < p.radius + 2) return p;
  }
  return null;
}

function deleteParticleAt(x, y) {
  for (let i = particles.length - 1; i >= 0; i--) {
    let p = particles[i];
    if (dist(x, y, p.pos.x, p.pos.y) < p.radius + 2) {
      particles.splice(i, 1);
      return;
    }
  }
}



// ==========================
// INFO PANEL
// ==========================
function updateInfoPanel() {
  document.getElementById("info-particles").innerText =
    "Particles: " + particles.length;

  let posCount = particles.filter(p => p.charge === 1).length;
  let negCount = particles.length - posCount;

  document.getElementById("info-positive").innerText = "Positive: " + posCount;
  document.getElementById("info-negative").innerText = "Negative: " + negCount;

  let toolName = ({
    addPlus: "Add + Charge",
    addMinus: "Add – Charge",
    addRandom: "Add Random Charge",
    select: "Select / Move",
    erase: "Erase"
  }[activeTool]) || "None";

  document.getElementById("info-tool").innerText =
    "Active Tool: " + toolName;
}



// ==========================
// UTILITY
// ==========================
function mouseInCanvas() {
  return (
    mouseX >= 0 && mouseX <= width &&
    mouseY >= 0 && mouseY <= height
  );
}
