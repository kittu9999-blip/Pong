// -- Game Setup --
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Define goal, ball, and goalkeeper positions
const GOAL = {
    x: 50,
    y: 80,
    width: 260,
    height: 28
};
const KICK_SPOT = { x: canvas.width/2, y: 480 };
const BALL_INIT = { x: KICK_SPOT.x, y: KICK_SPOT.y, r: 18 };

// State tracking
let ball, kicking, shot, drag, goalie, scored, showRestart, shotMessage;

// Helper: get position adjusting for device event type
function pointerPos(evt) {
    let rect = canvas.getBoundingClientRect();
    let x, y;
    if (evt.touches) {
        x = evt.touches[0].clientX - rect.left;
        y = evt.touches[0].clientY - rect.top;
    } else {
        x = evt.clientX - rect.left;
        y = evt.clientY - rect.top;
    }
    return {x, y};
}

// Reset everything for new shot
function resetGame() {
    kicking = false;
    drag = null;
    shot = null;
    showRestart = false;
    scored = false;
    shotMessage = "";
    ball = {...BALL_INIT};
    goalie = {
        x: GOAL.x + Math.random()*GOAL.width*0.7, // Randomize goalie horizontal position
        y: GOAL.y + 8,
        w: 45,
        h: 18,
        dir: Math.random() < .4 ? "left": (Math.random() < .5 ? "center" : "right"), // random stretch direction
        speed: Math.random() * 1.0 + 1.2
    };
}
resetGame();

// Draw goal (with posts & net)
function drawGoal() {
    // Draw net
    ctx.fillStyle = "#f4f6eb";
    ctx.fillRect(GOAL.x, GOAL.y, GOAL.width, GOAL.height);

    // Goal posts
    ctx.fillStyle = "#ddd";
    ctx.fillRect(GOAL.x-8, GOAL.y-2, 8, GOAL.height+18); // left
    ctx.fillRect(GOAL.x+GOAL.width, GOAL.y-2, 8, GOAL.height+18); // right
    // Crossbar
    ctx.fillRect(GOAL.x-10, GOAL.y-8, GOAL.width+20, 8);
}

// Draw ball
function drawBall() {
    ctx.save();
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI*2);
    ctx.closePath();
    ctx.fillStyle = "#fafafa";
    ctx.shadowColor = "#bbb9ad";
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.restore();
    // Tiny shadow on turf
    ctx.beginPath();
    ctx.arc(ball.x, ball.y+ball.r, ball.r*0.7, 0, Math.PI*2);
    ctx.fillStyle = "rgba(50,45,34,0.08)";
    ctx.fill();
    // Black patch
    ctx.beginPath();
    ctx.arc(ball.x-8, ball.y+2, 2.6, 0, Math.PI*2);
    ctx.arc(ball.x+4, ball.y-7, 3, 0, Math.PI*2);
    ctx.fillStyle='#444';
    ctx.fill();
}

// Draw goalkeeper
function drawGoalie() {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(goalie.x, goalie.y+goalie.h/2, goalie.w/2, goalie.h/2, 0, 0, Math.PI*2);
    ctx.fillStyle = "#174a98";
    ctx.shadowColor = "#183673";
    ctx.shadowBlur = 6;
    ctx.fill();
    // Draw head
    ctx.beginPath();
    ctx.arc(goalie.x, goalie.y+2, 8, 0, Math.PI*2);
    ctx.fillStyle="#fde890";
    ctx.shadowBlur=0;
    ctx.fill();
    // Arms
    ctx.save();
    ctx.strokeStyle = '#fdd37d';
    ctx.lineWidth = 7;
    if (goalie.dir === "left") {
        ctx.beginPath();
        ctx.moveTo(goalie.x-15, goalie.y+goalie.h/2);
        ctx.lineTo(goalie.x-goalie.w/2-10, goalie.y-14);
        ctx.stroke();
    }
    if (goalie.dir === "right") {
        ctx.beginPath();
        ctx.moveTo(goalie.x+15, goalie.y+goalie.h/2);
        ctx.lineTo(goalie.x+goalie.w/2+10, goalie.y-14);
        ctx.stroke();
    }
    ctx.restore();
    ctx.restore();
}

// Draw aim indicator when dragging (aim+power)
function drawAim() {
    if (drag) {
        ctx.setLineDash([4, 5]);
        ctx.beginPath();
        ctx.moveTo(ball.x, ball.y);
        ctx.lineTo(drag.x, drag.y);
        ctx.strokeStyle = "#fdde3a";
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.setLineDash([]);
        // Draw arrow tip
        let dx = drag.x-ball.x, dy = drag.y-ball.y;
        let ang = Math.atan2(dy, dx);
        let tipLen = 16;
        let tipX = ball.x + dx*0.6, tipY = ball.y + dy*0.6;
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(tipX-Math.cos(ang-Math.PI/8)*tipLen, tipY-Math.sin(ang-Math.PI/8)*tipLen);
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(tipX-Math.cos(ang+Math.PI/8)*tipLen, tipY-Math.sin(ang+Math.PI/8)*tipLen);
        ctx.strokeStyle = "#fdde3a";
        ctx.lineWidth = 3;
        ctx.stroke();
    }
}

// Draw power bar for effect
function drawPower() {
    if (drag) {
        let maxDist = 160;
        let dist = Math.min(160, Math.hypot(drag.x-ball.x, drag.y-ball.y));
        let pct = dist/maxDist;
        let bx = ball.x-45, by = ball.y+32;
        ctx.strokeStyle='#efefef50';
        ctx.lineWidth=7;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx+90, by);
        ctx.stroke();
        ctx.lineWidth=11;
        ctx.strokeStyle="#ffd317";
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx+90*pct,by);
        ctx.stroke();
        ctx.lineWidth=2;
        ctx.strokeStyle="#056951";
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx+90,by);
        ctx.stroke();
    }
}

// Draw main UI/messages
function drawText() {
    ctx.font = "bold 25px Segoe UI";
    ctx.fillStyle = '#ffffffde';
    ctx.textAlign="center";
    if (!kicking && !scored) {
        ctx.fillText("Drag & Release", canvas.width/2, canvas.height-22);
    } else if (scored && shotMessage) {
        ctx.fillText(shotMessage, canvas.width/2, 100);
    }
}

// Main render
function draw() {
    ctx.clearRect(0,0,canvas.width,canvas.height);

    drawGoal();
    drawGoalie();
    drawBall();
    drawAim();
    drawPower();
    drawText();

    if (showRestart) {
        document.getElementById("restartBtn").style.display = '';
    } else {
        document.getElementById("restartBtn").style.display = 'none';
    }
}

// Game step - update positions (ball & goalie), check goal/miss
function step() {
    if (kicking && shot) {
        // Ball movement
        ball.x += shot.vx;
        ball.y += shot.vy;
        // Slow ball down:
        shot.vx *= 0.992;
        shot.vy *= 0.992;
        // Goalie reacts - maybe stretch to block
        if (!shot.goalChecked) {
            // Goalie 'dive' toward likely kick spot
            let ballTgtX = ball.x + shot.vx*15;
            if (goalie.dir === "left") {
                if (goalie.x > GOAL.x+goalie.w/2)
                    goalie.x -= goalie.speed;
            }
            else if (goalie.dir==="right") {
                if (goalie.x < GOAL.x+GOAL.width-goalie.w/2)
                    goalie.x += goalie.speed;
            }
            else { 
                // Center, little move
                if (Math.abs(goalie.x-ballTgtX)>5)
                    goalie.x += (ballTgtX-goalie.x)*0.058;
            }
        }
        // Check goal line crossing:
        if (!shot.goalChecked && ball.y < GOAL.y+GOAL.height) {
            // Only count as goal if within posts, not overlapped with goalie
            const inPosts = (
                ball.x > GOAL.x+ball.r &&
                ball.x < GOAL.x+GOAL.width-ball.r
            );
            // Is goalie blocking?
            let blocked = false;
            if (
                ball.x >= goalie.x-goalie.w/2-8 && 
                ball.x <= goalie.x+goalie.w/2+8 &&
                ball.y <= goalie.y+goalie.h+16
            ) blocked = true;
            if (inPosts && !blocked) {
                scored = true;
                shotMessage = "GOAL!!";
            } else {
                scored = false;
                shotMessage = blocked ? "Saved!" : "Missed!";
            }
            shot.goalChecked = true;
            // Show restart after half sec
            setTimeout(() => showRestart=true, 600);
        }
        // If ball off screen
        if (ball.y < GOAL.y-20 || ball.x < 0 || ball.x > canvas.width) {
            kicking = false;
            drag = null;
            shot = null;
        }
    }
}

function gameLoop() {
    step();
    draw();
    requestAnimationFrame(gameLoop);
}

// Mouse/touch handlers
let isPointerDown = false;

// Start drag (aiming)
function handlePointerDown(e) {
    if (kicking || scored) return;
    let pos = pointerPos(e);
    // Ball is our start point, allow start only near ball
    if (Math.hypot(pos.x-ball.x, pos.y-ball.y) < ball.r+15) {
        drag = {...pos};
        isPointerDown = true;
    }
    e.preventDefault();
}
function handlePointerMove(e) {
    if (drag && isPointerDown) {
        let pos = pointerPos(e);
        drag.x = pos.x;
        drag.y = pos.y;
    }
    e.preventDefault();
}
function handlePointerUp(e) {
    // Only if dragging to shoot
    if (drag) {
        let dx = drag.x - ball.x, dy = drag.y - ball.y;
        let dist = Math.max(35, Math.hypot(dx, dy));
        let clampedDist = Math.min(dist, 160);
        let angle = Math.atan2(dy, dx);
        // The further, the more 'power'
        let power = clampedDist / 26;
        shot = {
            vx: Math.cos(angle) * power * 1.31,
            vy: Math.sin(angle) * power * 1.29 * -1, // up is negative y
            goalChecked: false
        };
        kicking = true;
        drag = null;
    }
    e.preventDefault();
    isPointerDown = false;
}

// Handle restart
document.getElementById("restartBtn").addEventListener("click", () => {
    resetGame();
});

// Touch events for mobile
canvas.addEventListener("touchstart", handlePointerDown, { passive: false });
canvas.addEventListener("touchmove", handlePointerMove, { passive: false });
canvas.addEventListener("touchend", handlePointerUp, { passive: false });

// Mouse events for desktop
canvas.addEventListener("mousedown", handlePointerDown);
canvas.addEventListener("mousemove", handlePointerMove);
canvas.addEventListener("mouseup", handlePointerUp);
canvas.addEventListener("mouseleave", function() { drag = null; }, false);

// Prevent scrolling on touch
document.body.addEventListener('touchstart', function(event) {
    if (event.target === canvas) event.preventDefault();
}, {passive: false});

// Start main loop
gameLoop();
