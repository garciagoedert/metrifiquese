
// Code By Webdevtrick ( https://webdevtrick.com )
(function() {
	'use strict';
	var tasker = {
		init: function() {
			this.cacheDom();
			this.bindEvents();
			this.evalTasklist();
		},
		cacheDom: function() {
			this.taskInput = document.getElementById("input-task");
			this.addBtn = document.getElementById("add-task");
			this.tasklist = document.getElementById("tasks");
			this.tasklistChildren = this.tasklist.children;
			this.errorMessage = document.getElementById("error");
		},
		bindEvents: function() {
			this.addBtn.onclick = this.addTask.bind(this);
			this.taskInput.onkeypress = this.enterKey.bind(this);
		},
		evalTasklist: function() {
			var i, chkBox, delBtn;
			for (i = 0; i < this.tasklistChildren.length; i += 1) {
 
				chkBox = this.tasklistChildren[i].getElementsByTagName("input")[0];
				chkBox.onclick = this.completeTask.bind(this, this.tasklistChildren[i], chkBox);
 
				delBtn = this.tasklistChildren[i].getElementsByTagName("button")[0];
				delBtn.onclick = this.delTask.bind(this, i);
			}
		},
		render: function() {
			var taskLi, taskChkbx, taskVal, taskBtn, taskTrsh;
			taskLi = document.createElement("li");
			taskLi.setAttribute("class", "task");
			taskChkbx = document.createElement("input");
			taskChkbx.setAttribute("type", "checkbox");
			taskVal = document.createTextNode(this.taskInput.value);
			taskBtn = document.createElement("button");
			taskTrsh = document.createElement("i");
			taskTrsh.setAttribute("class", "fa fa-trash");
			taskBtn.appendChild(taskTrsh);
 
			taskLi.appendChild(taskChkbx);
			taskLi.appendChild(taskVal);
			taskLi.appendChild(taskBtn);
 
			this.tasklist.appendChild(taskLi);
 
		},
		completeTask: function(i, chkBox) {
			if (chkBox.checked) {
				i.className = "task completed";
			} else {
				this.incompleteTask(i);
			}
		},
		incompleteTask: function(i) {
			i.className = "task";
		},
		enterKey: function(event) {
			if (event.keyCode === 13 || event.which === 13) {
				this.addTask();
			}
		},
		addTask: function() {
			var value = this.taskInput.value;
			this.errorMessage.style.display = "none";
 
			if (value === "") {
				this.error();
			} else {
				this.render();
				this.taskInput.value = "";
				this.evalTasklist();
			}
		},
		delTask: function(i) {
			this.tasklist.children[i].remove();
			this.evalTasklist();
		},
		error: function() {
			this.errorMessage.style.display = "block";
		}
	};
 
	tasker.init();
}());

// daily message
// Instantiate a new typist.js control
new Typist({
    "element": ".typist",
    "delay": 1000,
    "display": "inline",
    "callback": function() {
        //alert("This is a completed callback test");
    }
});

/**
    * @function Typist - Defines an Typist constructor for displaying testimonial excerpts.
    * @param {object} config - The instance of the Typist control being configured.
    * @param {number} config.element - The element selector in which to apply the typist functionality.
    * @param {string} config.delay - The time to wait before beginning the typist cycle.
    * @param {string} config.display - The CSS display property for the typist control when rendered.
    * @param {number} config.callback - The function to call once the typist is complete;
*/
function Typist(config) {
  'use-strict';
  
  var ERRORS = {
      "CONTAINER_ELEMENT": "config.element may be invalid or undefined",
      "CALLBACK_FUNCTION": "config.callback may be invalid"
  }
  
  var index = 0,
      elements = document.querySelectorAll(config.element),
      messageIndex = Math.floor(Math.random() * (elements.length));
      msg = elements[messageIndex].innerHTML;
  
  prepElement(elements[messageIndex]);
  setTimeout(pressChars, config.delay);

  function pressChars() {
    var random = Math.random() * 200,
        msgArr = msg.split(''); 

    setTimeout(function() {
      elements[messageIndex].innerHTML += msgArr[index];

      if(index < msg.length - 1) {
        index++;
        pressChars();
      } else if(index = msg.length && config.callback) {
        (config.callback && typeof(config.callback) === 'function')
            ? config.callback()
            : throwError(ERRORS.CALLBACK_FUNCTION);
      }

    }, random);
  }

  function prepElement(element) {
    element.innerHTML = '';
    element.style.display = config.display || 'inline-block';
  }
  
  function throwError(errorMsg) {
      throw new Error(errorMsg);
  }
};
// daily message end