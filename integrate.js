/*
 * Copyright 2017-2020 Jiří Janoušek <janousek.jiri@gmail.com>
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
  const player = Nuvola.$object(Nuvola.MediaPlayer)
  const PlaybackState = Nuvola.PlaybackState
  const PlayerAction = Nuvola.PlayerAction
  const WebApp = Nuvola.$WebApp()

  WebApp._onLastPageRequest = function (emitter, result) {
    Nuvola.WebApp._onLastPageRequest.call(this, emitter, result)
    if (result.url && (result.url.startsWith('file://') || result.url.startsWith('https://github.com/'))) {
      result.url = null
    }
  }

  WebApp._onInitWebWorker = function (emitter) {
    Nuvola.WebApp._onInitWebWorker.call(this, emitter)
    const state = document.readyState
    if (state === 'interactive' || state === 'complete') {
      this._onPageReady()
    } else {
      document.addEventListener('DOMContentLoaded', this._onPageReady.bind(this))
    }
    this.targetRepeatStatus = null
  }

  WebApp._onPageReady = function () {
    Nuvola.actions.connect('ActionActivated', this)
    this.update()
  }

  WebApp.update = function () {
    try {
      const track = {
        title: null,
        artist: null,
        album: null,
        artLocation: null,
        rating: null,
        length: null
      }
      let elm = null
      elm = document.querySelector('#main .now-playing [data-testid="nowplaying-track-link"]')
      if (elm) {
        track.title = elm.textContent || null
      }
      elm = document.querySelector('#main .Root__media [href^="/artist/"]')
      if (elm) {
        track.artist = elm.textContent || null
      }
      track.artLocation = Nuvola.queryAttribute(
        '#main .now-playing .cover-art img',
        'src',
        src => src ? src.replace('00004851', '00001e02') : null
      )

      const trackTime = this.trackTime()
      track.length = trackTime.total
      player.setTrack(track)
      player.setTrackPosition(trackTime.now)

      let state
      const buttons = this.buttons()
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

      const repeat = this._getRepeatStatus(buttons.repeat)
      Nuvola.actions.updateEnabledFlag(PlayerAction.REPEAT, repeat !== null)
      Nuvola.actions.updateState(PlayerAction.REPEAT, repeat || 0)

      const shuffle = buttons.shuffle ? buttons.shuffle.classList.contains('control-button--active') : null
      Nuvola.actions.updateEnabledFlag(PlayerAction.SHUFFLE, shuffle !== null)
      Nuvola.actions.updateState(PlayerAction.SHUFFLE, !!shuffle)
    } finally {
      setTimeout(this.update.bind(this), 500)
    }
  }

  WebApp._getRepeatStatus = function (button) {
    if (!button) {
      return null
    }
    const classes = button.classList
    if (!classes.contains('control-button--active')) {
      return Nuvola.PlayerRepeat.NONE
    }
    for (const value of classes.values()) {
      if (value.includes('repeatonce')) {
        return Nuvola.PlayerRepeat.TRACK
      }
    }
    return Nuvola.PlayerRepeat.PLAYLIST
  }

  WebApp._setRepeatStatus = function (button, repeat) {
    if (this.targetRepeatStatus !== null) {
      this.targetRepeatStatus = repeat
    } else {
      this.targetRepeatStatus = repeat
      this._toggleRepeatStatusIfChanged(button, null)
    }
  }

  WebApp._toggleRepeatStatusIfChanged = function (button, originalRepeat) {
    if (!button || this.targetRepeatStatus === null) {
      console.log('Do not have repeat button!')
      this.targetRepeatStatus = null
      return
    }
    const repeat = this._getRepeatStatus(button)
    if (repeat === this.targetRepeatStatus) {
      this.targetRepeatStatus = null
    } else {
      if (repeat !== originalRepeat) {
        // The repeat status has changed but we need to toggle further
        originalRepeat = repeat
        Nuvola.clickOnElement(button)
      }
      setTimeout(() => this._toggleRepeatStatusIfChanged(button, originalRepeat), 500)
    }
  }

  WebApp._onActionActivated = function (emitter, name, parameter) {
    const buttons = this.buttons()
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
      case PlayerAction.SEEK: {
        const trackTime = this.trackTime()
        const total = Nuvola.parseTimeUsec(trackTime.total)
        if (parameter >= 0 && parameter <= total) {
          Nuvola.clickOnElement(
            document.querySelector('#main .player-controls .progress-bar__bg'), parameter / total, 0.5)
        }
        break
      }
      case PlayerAction.CHANGE_VOLUME:
        Nuvola.clickOnElement(document.querySelector('#main .volume-bar .progress-bar'), parameter, 0.5)
        break
      case PlayerAction.SHUFFLE:
        Nuvola.clickOnElement(buttons.shuffle)
        break
      case PlayerAction.REPEAT:
        this._setRepeatStatus(buttons.repeat, parameter)
        break
      default:
        throw Error('Action "' + name + '" not supported.')
    }
  }

  WebApp.trackTime = function () {
    const elms = document.querySelectorAll('#main .player-controls .playback-bar__progress-time')
    return {
      now: elms.length ? elms[0].textContent || null : null,
      total: elms.length > 1 ? elms[1].textContent || null : null
    }
  }

  WebApp.volume = function () {
    const elm = document.querySelector('#main .volume-bar .progress-bar__slider')
    return elm && elm.style.left.endsWith('%') ? elm.style.left.slice(0, -1) / 100 : null
  }

  WebApp.buttons = function () {
    const children = document.querySelectorAll('#main .player-controls .player-controls__buttons > button')
    const buttons = {
      shuffle: children[0] || null,
      prev: children[1] || null,
      play: children[2] || null,
      next: document.querySelector('#main .player-controls .player-controls__buttons button.spoticon-skip-forward-16'),
      repeat: document.querySelector('#main .player-controls .player-controls__buttons button.spoticon-repeat-16'),
      pause: null
    }
    if (buttons.play && buttons.play.firstElementChild.firstElementChild.getAttribute('fill') === 'none') {
      buttons.pause = buttons.play
      buttons.play = null
    }
    for (const key in buttons) {
      if (buttons[key] && buttons[key].disabled) {
        buttons[key] = null
      }
    }
    return buttons
  }

  WebApp.start()
})(this)
