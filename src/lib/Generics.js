import Vue from 'vue';
import elasticsearch from 'elasticsearch';
import Bodybuilder from 'bodybuilder';
import Store from './Store';

export default Vue.mixin({
	computed : {
		// Full Elasticsearch request
		request : function() {
			return Object.assign({
				index : this.header.index,
				type : this.header.type
			}, {
				body : this.body
			});
		},

		// Request header (index, type, client)
		header : () => {
			return Store.getters["Elasticsearch/getHeader"];
		},

		// Request query (generated bodybuilder json request)
		body : () => {
			return Store.getters["Elasticsearch/getBody"];
		},

		// Instructions (contains bodybuilder functions)
		instructions : () => {
			return Store.getters["Elasticsearch/getInstructions"];
		},

		// Aggregations (contains all components aggregations objects)
		aggregations : () => {
			return Store.getters["Elasticsearch/getAggregations"];
		},


		// Output items
		items : () => {
			return Store.getters["Hits/getItems"];
		},

		// Items count
		score : () => {
			return Store.getters["Hits/getScore"];
		},
	},

	methods : {
		/*
			Store Elasticsearch Header Setters
		*/
		setHost : (host) => {
			Store.commit("Elasticsearch/setHost", new elasticsearch.Client({ host }));
		},
		setIndex : (index) => {
			Store.commit("Elasticsearch/setIndex", index);
		},
		setType : (type) => {
			Store.commit("Elasticsearch/setType", type);
		},


		/*
			Store Elasticsearch Body Setter
		*/
		setBody : (body) => {
			Store.commit("Elasticsearch/setBody", body);
		},


		/*
			Store Elasticsearch Instructions Add
		*/
		addInstruction : (instruction) => {
			Store.commit("Elasticsearch/addInstruction", instruction);
		},

		/*
			Store Elasticsearch Instructions Remove
		*/
		removeInstruction : (instruction) => {
			Store.commit("Elasticsearch/removeInstruction", instruction);
		},


		/*
			Store Elasticsearch Aggregations Settings
		*/
		setAggregations : (name, value, isDynamic,orderKey, orderDirection) => {
			Store.commit("Elasticsearch/setAggregations", { name, value, isDynamic, orderKey, orderDirection });
		},


		/*
			Add a debounce event to ES store
			That permits to clear (reset) all listed hanged debounces when an user is triggered fetch()
		*/
		addDebounce : (debounce) => {
			Store.commit("Elasticsearch/addDebounce", debounce);
		},


		/*
			Reset all the listed debounces
			Called by fetch()
		*/
		resetDebounce : () => {
			Store.commit("Elasticsearch/resetDebounce");
		},



		
		/*
			Add item into the Store
		*/
		addItem : (item) => {
			Store.commit("Hits/addItem", item);
		},


		/*
			Empty the store items list
		*/
		clearItems : () => {
			Store.commit("Hits/clearItems");
		},


		/*
			Set the score of items
		*/
		setScore : (score) => {
			Store.commit("Hits/setScore", score);
		},


		/*
			Mount global function
		*/
		mountInstructions : function(instructions) {
			// Bodybuilder object
			let BD = Bodybuilder();

			// Execute all instructions to create request
			instructions.forEach(instr => {
				BD[instr.fun](...instr.args);
			});

			// Return the built request
			return BD.build();
		},

		/*
			Mount full request
		*/
		mount : function() {
			// Bodybuilder object
			let BD = Bodybuilder().from(0).size(10);

			// Execute all instructions to create request
			this.instructions.forEach(instr => {
				BD[instr.fun](...instr.args);
			});

			// Store the JSON request into the body
			this.setBody(BD.build());

			// Debug
			//console.log("[Generics:Mount] Body : ", Store.getters.getBody);
			//console.log("[Generics:Mount] Request : ", this.request);
		},


		/*
			Execute ES request
		*/
		fetch : function() {
			//console.log("[Generics:Fetch] Request : ", this.request);

			// Reset debounce events
			this.resetDebounce();

			// Fetch the hits
			this.header.client.search(this.request).then((resp) => {

				// Remove all hits
				this.clearItems();

				var hits = resp.hits.hits;
				console.log("[Generics:Fetch] Response : ", resp);
				//console.log("[Generics:Fetch] Aggs : ", resp.aggregations);

				/***
				 * Update aggregations after each ES request
				 */
				var event = new CustomEvent('updateAggs', { 'detail' : resp.aggregations });
				if (resp.aggregations !== undefined)
					document.dispatchEvent(event);

				if (hits.length === 0)
					this.setScore(0);
				else {
					hits.forEach((hit) => {
						this.addItem(hit);
					});

					this.setScore(resp.hits.total)
				}
			}, function (err) {
				this.setScore(0);
			});

			// Debug
			//console.log("[Generics:Fetch] Work : ", "done");
		},


		// field name of the aggs that we want to fetch
		createRequestForAggs : function (field,size,orderKey,orderDirection) {

			// Bodybuilder object
			let _request = this.clone(this.request);

			// Store the JSON request into the body
			_request.body = Bodybuilder()
				.size(200)
				.aggregation("terms", field,{ order : { [orderKey] : orderDirection } , size : size })
				.build();

			return _request;
		},

		clone : (object) => {
			return JSON.parse(JSON.stringify(object));
		},

		remove : (object) => {
			delete object.fun;
			delete object.args;
		}
	}
});