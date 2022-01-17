function triggerLayer() {

    Layer.checkout(
        {
            token: layer_params.payment_token_id,
            accesskey: layer_params.accesskey,			
        },
        function (response) {
            console.log(response)
            if(response !== null || response.length > 0 ){

                if(response.payment_id !== undefined){

                    document.getElementById('layer_payment_id').value = response.payment_id;

                }

            }

            document.layer_payment_int_form.submit();
        },
        function (err) {
            alert(err.message);
        }
    );
}
/*
var checkExist = setInterval(function() {
	if (typeof Layer !== 'undefined') {
		console.log('Layer Loaded...');
		clearInterval(checkExist);
		triggerLayer();
	}
	else {
		console.log('Layer undefined...');
	}
}, 1000);
*/
