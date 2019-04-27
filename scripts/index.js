// context params
var player = document.getElementById('player');
var record = document.getElementById('record');
var pause = document.getElementById('pause');
var resume = document.getElementById('resume');
var stop = document.getElementById('stop');
var microphone, 
    processor,
    recordingGainNode,
    monitorGainNode, 
    audioCtx,
    microphoneStream,
    mp3Worker,
    mp3Audio,
    currentAudio,
    currentRecordStatus = "stop";
    timingInterval = null
var RECORD_TIME_LIMIT = 300; // in elapsedTime max 5 mins recording
//main block for doing the audio recording
stop.disabled = true;
resume.disabled = true;
pause.disabled = true;
// should be browser vendor agnostic for AudioContext

var AudioContext = window.AudioContext || window.webkitAudioContext;
// dom events
record.onclick = function() {
  initWorker();
  mp3Worker.postMessage({cmd: 'init'});
  audioCtx = new AudioContext();
  navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    .then(function(stream) {
      // startTime();
      if(currentRecordStatus == "stop" || currentRecordStatus == "paused") {
        currentRecordStatus = "record";
      }
      elapsedTime = 0;
      stop.disabled = false;
      record.disabled = true;
      pause.disabled = false;
      microphoneStream = stream;
      // audio Context  use default 
      // buffer 2048, numberOfInputChannels 1, numberOfOutputChannels 1 default is 2 for both
      // Create async stream for audio processing
      // Settings a bufferSize of 0 instructs the browser to choose the best bufferSize
      processor = audioCtx.createScriptProcessor(0, 1, 1);
      processor.onaudioprocess = function(event){
        if(currentRecordStatus == "record") {
          var array = event.inputBuffer.getChannelData(0);
          mp3Worker.postMessage({cmd: 'encode', buf: array});
        }
      };
      
      // connect mic to audio context
      microphone = audioCtx.createMediaStreamSource( stream );
      microphone.connect(processor);
      // destination is where the audio be output
      processor.connect(audioCtx.destination);
      console.log("recorder started");

      // action on the input audio stream from mic
      

      // setup time interval

      var updateTimer = function(){
        minutes = Math.floor(elapsedTime / 60) < 10 ? 
            '0' + Math.floor(elapsedTime / 60) : Math.floor(elapsedTime / 60);
        secondsDigit = elapsedTime % 60 < 10 ? '0' + elapsedTime % 60 : elapsedTime % 60;
        document.getElementById("time").innerText =  minutes + ":" + secondsDigit+"/05:00";
      };

      timingInterval = window.setInterval(function(){
        if(currentRecordStatus == "record") {
          elapsedTime++;
          updateTimer();
          if(elapsedTime === RECORD_TIME_LIMIT)
          {
            cancelTiming();
            stopRecord();
          }
        }
      },1000);
      updateTimer();



  });

}

stop.onclick = function() {
  cancelTiming();
  stopRecord();
};

pause.onclick = function() {
  pauseRecord();
}

resume.onclick = function() {
  resumeRecord();
}

// utility functions
var initWorker = function() {
  if(!window.Worker) {
    console.warn('Worker API not supported in this browser');
    return;
  }
  if(mp3Worker == null)
  {
    mp3Worker = new Worker('./scripts/mp3Worker.js');
    mp3Worker.onmessage = function(e) {
      switch(e.data.cmd) {
        case 'end':
          // mp3Audio = e.data.buf;
          console.log("mp3 data length" +  e.data.buf.length + " B (bytes).");
          // console.log(mp3Audio);

          var blob = new Blob(e.data.buf, {type: 'audio/mp3'});
          var url = window.URL.createObjectURL(blob);
          console.log(url);
          // currentAudio = new Audio(url);
          player.controls = true;
          player.src = url;
          stopWorker();
          break;
        default :
          console.log("Something probably went wrong");
      }
    }
    mp3Worker.postMessage({cmd: 'init'});
  }
  
};

var getMp3Audio = function() {
  if(mp3Worker) {
    mp3Worker.postMessage({cmd:'finish'});
  }
};

var stopWorker = function() {
  if(mp3Worker) {
    mp3Worker.terminate();
    console.log("Ending mp3 worker");
    mp3Worker = null;
  }
};


var stopRecord = function() {
  if(microphone && processor) {
    microphone.disconnect();
    processor.disconnect();
    processor.onaudioprocess = null;
    getMp3Audio();
    if(currentRecordStatus == "record" || currentRecordStatus == "paused") {
      currentRecordStatus = "stop";
    }
    stop.disabled = true;
    record.disabled = false;
    pause.disabled = true;
    resume.disabled = true;

    microphoneStream.getTracks().forEach( function( track ){
      track.stop();
    });
  }
};

var pauseRecord = function() {
  if(currentRecordStatus == "record") {
    pause.disabled = true;
    microphoneStream.getTracks().forEach( function( track ){
      track.enabled = false;
    });
    currentRecordStatus = "paused";
    resume.disabled = false;
  }
}

var resumeRecord = function() {
  if(currentRecordStatus == "paused") {
    resume.disabled = true;
    microphoneStream.getTracks().forEach( function( track ){
      track.enabled = true;
    });
    currentRecordStatus = "record";
    pause.disabled = false;
  }
}


var cancelTiming = function() {
  if(timingInterval)
  {
    clearInterval(timingInterval);
  }
};

