func getQueryResultForQueryString(ctx contractapi.TransactionContextInterface, queryString string) ([]map[string]interface{}, error) {
	resultsIterator, err := ctx.GetStub().GetQueryResult(queryString)
	if err != nil {
		return nil, err
	}
	defer resultsIterator.Close()

	var results []map[string]interface{}

	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		var record map[string]interface{}
		err = json.Unmarshal(queryResponse.Value, &record)
		if err != nil {
			return nil, err
		}

		record["_key"] = queryResponse.Key
		results = append(results, record)
	}

	return results, nil
}

func (s *SmartContract) GetWalletByCustomerID(ctx contractapi.TransactionContextInterface, customerId string) ([]map[string]interface{}, error) {
	queryString := fmt.Sprintf(`{
		"selector": {
			"docType": "wallet",
			"customerId": "%s"
		},
		"use_index": ["indexWalletByCustomerIdDoc", "indexWalletByCustomerId"]
	}`, customerId)

	return getQueryResultForQueryString(ctx, queryString)
}

func (s *SmartContract) GetOrganizationByID(ctx contractapi.TransactionContextInterface, organizationId string) ([]map[string]interface{}, error) {
	queryString := fmt.Sprintf(`{
		"selector": {
			"docType": "organization",
			"organizationId": "%s"
		},
		"use_index": ["indexOrganizationByIdDoc", "indexOrganizationById"]
	}`, organizationId)

	return getQueryResultForQueryString(ctx, queryString)
}

func (s *SmartContract) GetTransactionsByStatus(ctx contractapi.TransactionContextInterface, status string) ([]map[string]interface{}, error) {
	queryString := fmt.Sprintf(`{
		"selector": {
			"docType": "transaction",
			"status": "%s"
		},
		"use_index": ["indexTransactionByStatusDoc", "indexTransactionByStatus"]
	}`, status)

	return getQueryResultForQueryString(ctx, queryString)
}

func (s *SmartContract) GetTransactionsByRiskLevel(ctx contractapi.TransactionContextInterface, riskLevel string) ([]map[string]interface{}, error) {
	queryString := fmt.Sprintf(`{
		"selector": {
			"docType": "transaction",
			"riskLevel": "%s"
		},
		"use_index": ["indexTransactionByRiskLevelDoc", "indexTransactionByRiskLevel"]
	}`, riskLevel)

	return getQueryResultForQueryString(ctx, queryString)
}

func (s *SmartContract) GetTransactionsByDateRange(ctx contractapi.TransactionContextInterface, fromDate string, toDate string) ([]map[string]interface{}, error) {
	queryString := fmt.Sprintf(`{
		"selector": {
			"docType": "transaction",
			"createdAt": {
				"$gte": "%s",
				"$lte": "%s"
			}
		},
		"use_index": ["indexTransactionByDateDoc", "indexTransactionByDate"]
	}`, fromDate, toDate)

	return getQueryResultForQueryString(ctx, queryString)
}

func (s *SmartContract) GetOutgoingTransactionsByWallet(ctx contractapi.TransactionContextInterface, walletAddress string, fromDate string, toDate string) ([]map[string]interface{}, error) {
	queryString := fmt.Sprintf(`{
		"selector": {
			"docType": "transaction",
			"fromWalletAddress": "%s",
			"createdAt": {
				"$gte": "%s",
				"$lte": "%s"
			}
		},
		"use_index": ["indexTransactionByFromWalletDateDoc", "indexTransactionByFromWalletDate"]
	}`, walletAddress, fromDate, toDate)

	return getQueryResultForQueryString(ctx, queryString)
}

func (s *SmartContract) GetIncomingTransactionsByWallet(ctx contractapi.TransactionContextInterface, walletAddress string, fromDate string, toDate string) ([]map[string]interface{}, error) {
	queryString := fmt.Sprintf(`{
		"selector": {
			"docType": "transaction",
			"toWalletAddress": "%s",
			"createdAt": {
				"$gte": "%s",
				"$lte": "%s"
			}
		},
		"use_index": ["indexTransactionByToWalletDateDoc", "indexTransactionByToWalletDate"]
	}`, walletAddress, fromDate, toDate)

	return getQueryResultForQueryString(ctx, queryString)
}

