/*
 * Copyright 2017-2018 Jiří Janoušek <janousek.jiri@gmail.com>
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *  list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *  this list of conditions and the following disclaimer in the documentation
 *  and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS 'AS IS' AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
 * ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

'use strict';

(function (Nuvola) {
  var player = Nuvola.$object(Nuvola.MediaPlayer)
  var PlaybackState = Nuvola.PlaybackState
  var PlayerAction = Nuvola.PlayerAction
  var WebApp = Nuvola.$WebApp()

  WebApp._onLastPageRequest = function (emitter, result) {
    Nuvola.WebApp._onLastPageRequest.call(this, emitter, result)
    if (result.url && (result.url.startsWith('file://') || result.url.startsWith('https://github.com/'))) {
      result.url = null
    }
  }

  WebApp._onInitWebWorker = function (emitter) {
    Nuvola.WebApp._onInitWebWorker.call(this, emitter)
    var state = document.readyState
    if (state === 'interactive' || state === 'complete') {
      this._onPageReady()
    } else {
      document.addEventListener('DOMContentLoaded', this._onPageReady.bind(this))
    }
  }

  WebApp._onPageReady = function () {
    Nuvola.actions.connect('ActionActivated', this)
    this.update()
  }

  WebApp.update = function () {
    try {
      var track = {
        title: null,
        artist: null,
        album: null,
        artLocation: null,
        rating: null,
        length: null
      }
      var elm = null
      elm = document.querySelector('#main .now-playing .track-info__name')
      if (elm) {
        track.title = elm.textContent || null
      }
      elm = document.querySelector('#main .now-playing .track-info__artists')
      if (elm) {
        track.artist = elm.textContent || null
      }
      elm = document.querySelector('#main .now-playing .cover-art-image')
      if (elm) {
        var url = elm.style.backgroundImage
        track.artLocation = url.startsWith('url(') ? url.slice(5, -2) : null
      }
      var trackTime = this.trackTime()
      track.length = trackTime.total
      player.setTrack(track)
      player.setTrackPosition(trackTime.now)

      var state
      var buttons = this.buttons()
      if (!trackTime.total || trackTime.total === '0:00') {
        state = PlaybackState.UNKNOWN
      } else if (buttons.play) {
        state = PlaybackState.PAUSED
      } else if (buttons.pause) {
        state = PlaybackState.PLAYING
      }
      player.updateVolume(this.volume())
      player.setPlaybackState(state)
      player.setCanSeek(state !== PlaybackState.UNKNOWN)
      player.setCanChangeVolume(state !== PlaybackState.UNKNOWN)
      player.setCanGoPrev(state !== PlaybackState.UNKNOWN && !!buttons.prev)
      player.setCanGoNext(state !== PlaybackState.UNKNOWN && !!buttons.next)
      player.setCanPlay(state !== PlaybackState.UNKNOWN && !!buttons.play)
      player.setCanPause(state !== PlaybackState.UNKNOWN && !!buttons.pause)
    } finally {
      setTimeout(this.update.bind(this), 500)
    }
  }

  WebApp._onActionActivated = function (emitter, name, parameter) {
    var buttons = this.buttons()
    switch (name) {
      case PlayerAction.TOGGLE_PLAY:
        Nuvola.clickOnElement(buttons.play || buttons.pause)
        break
      case PlayerAction.PLAY:
        Nuvola.clickOnElement(buttons.play)
        break
      case PlayerAction.PAUSE:
        Nuvola.clickOnElement(buttons.pause)
        break
      case PlayerAction.STOP:
        Nuvola.clickOnElement(buttons.pause)
        break
      case PlayerAction.PREV_SONG:
        Nuvola.clickOnElement(buttons.prev)
        break
      case PlayerAction.NEXT_SONG:
        Nuvola.clickOnElement(buttons.next)
        break
      case PlayerAction.SEEK:
        var trackTime = this.trackTime()
        var total = Nuvola.parseTimeUsec(trackTime.total)
        if (parameter >= 0 && parameter <= total) {
          Nuvola.clickOnElement(
            document.querySelector('#main .player-controls .progress-bar__bg'), parameter / total, 0.5)
        }
        break
      case PlayerAction.CHANGE_VOLUME:
        Nuvola.clickOnElement(document.querySelector('#main .volume-bar .progress-bar__bg'), parameter, 0.5)
        break
      default:
        throw Error('Action "' + name + '" not supported.')
    }
  }

  WebApp.trackTime = function () {
    var elms = document.querySelectorAll('#main .player-controls .playback-bar__progress-time')
    return {
      now: elms.length ? elms[0].textContent || null : null,
      total: elms.length > 1 ? elms[1].textContent || null : null
    }
  }

  WebApp.volume = function () {
    var elm = document.querySelector('#main .volume-bar .progress-bar__fg')
    return elm && elm.style.width.endsWith('%') ? elm.style.width.slice(0, -1) / 100 : null
  }

  WebApp.buttons = function () {
    var elm = document.querySelector('#main .player-controls .player-controls__buttons')
    var children = elm ? elm.childNodes : [null, null, null, null, null]
    var buttons = {
      shuffle: children[0],
      prev: children[1],
      play: children[2],
      next: children[3],
      repeat: children[4],
      pause: null
    }
    if (buttons.play && buttons.play.className.includes('pause')) {
      buttons.pause = buttons.play
      buttons.play = null
    }
    return buttons
  }

  WebApp.start()
})(this)
